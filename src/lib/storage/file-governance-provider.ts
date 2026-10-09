import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ApprovalStatus,
  GovernanceApproval,
  GovernanceDecision,
  GovernanceRule,
  GovernanceStorageProvider,
} from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const GOVERNANCE_FILE = path.join(DATA_DIR, "governance.json");
const MAX_DECISIONS = 5000;

interface GovernanceFile {
  rules: GovernanceRule[];
  decisions: GovernanceDecision[];
  approvals: Record<string, GovernanceApproval>;
}

const EMPTY: GovernanceFile = { rules: [], decisions: [], approvals: {} };

export class FileGovernanceStorageProvider implements GovernanceStorageProvider {
  readonly name = "file";
  private file: GovernanceFile | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  private async load(): Promise<GovernanceFile> {
    if (this.file) return this.file;
    try {
      const raw = await readFile(GOVERNANCE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<GovernanceFile>;
      this.file = {
        rules: parsed.rules ?? [],
        decisions: parsed.decisions ?? [],
        approvals: parsed.approvals ?? {},
      };
    } catch {
      this.file = { ...EMPTY, rules: [], decisions: [], approvals: {} };
    }
    return this.file;
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(GOVERNANCE_FILE, JSON.stringify(this.file, null, 2));
  }

  private withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeLock.then(fn);
    this.writeLock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async listRules(): Promise<GovernanceRule[]> {
    const file = await this.load();
    return file.rules;
  }

  async putRules(rules: GovernanceRule[]): Promise<void> {
    await this.withWriteLock(async () => {
      const file = await this.load();
      file.rules = rules;
      await this.persist();
    });
  }

  async setRuleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.withWriteLock(async () => {
      const file = await this.load();
      const rule = file.rules.find((r) => r.id === id);
      if (rule) {
        rule.enabled = enabled;
        await this.persist();
      }
    });
  }

  async appendDecision(decision: GovernanceDecision): Promise<void> {
    await this.withWriteLock(async () => {
      const file = await this.load();
      file.decisions.push(decision);
      if (file.decisions.length > MAX_DECISIONS) {
        file.decisions = file.decisions.slice(-MAX_DECISIONS);
      }
      await this.persist();
    });
  }

  async listDecisions(input: { workspaceId?: string; limit?: number }): Promise<GovernanceDecision[]> {
    const file = await this.load();
    const filtered = input.workspaceId
      ? file.decisions.filter((d) => d.workspaceId === input.workspaceId)
      : file.decisions;
    return filtered.slice(-(input.limit ?? 100)).reverse();
  }

  async createApproval(record: GovernanceApproval): Promise<GovernanceApproval> {
    return this.withWriteLock(async () => {
      const file = await this.load();
      file.approvals[record.id] = record;
      await this.persist();
      return record;
    });
  }

  async getApproval(id: string): Promise<GovernanceApproval | null> {
    const file = await this.load();
    return file.approvals[id] ?? null;
  }

  async decideApproval(
    id: string,
    next: GovernanceApproval,
    now = new Date(),
  ): Promise<GovernanceApproval | null> {
    return this.withWriteLock(async () => {
      const file = await this.load();
      const stored = file.approvals[id];
      if (!stored || stored.status !== "pending") return null;
      if (new Date(stored.expiresAt).getTime() <= now.getTime()) return null;
      file.approvals[id] = next;
      await this.persist();
      return next;
    });
  }

  async consumeGrant(id: string, now = new Date()): Promise<GovernanceApproval | null> {
    return this.withWriteLock(async () => {
      const file = await this.load();
      const stored = file.approvals[id];
      if (!stored || stored.status !== "approved" || !stored.grantTokenHash) return null;
      if (stored.grantExpiresAt && new Date(stored.grantExpiresAt).getTime() <= now.getTime()) {
        return null;
      }
      stored.status = "consumed";
      await this.persist();
      return stored;
    });
  }

  async getApprovalByGrantHash(grantTokenHash: string): Promise<GovernanceApproval | null> {
    const file = await this.load();
    return (
      Object.values(file.approvals).find((a) => a.grantTokenHash === grantTokenHash) ?? null
    );
  }

  async listApprovals(input: {
    workspaceId: string;
    status?: ApprovalStatus;
    limit?: number;
  }): Promise<Omit<GovernanceApproval, "grantTokenHash">[]> {
    const file = await this.load();
    return Object.values(file.approvals)
      .filter((a) => a.workspaceId === input.workspaceId && (!input.status || a.status === input.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, input.limit ?? 50)
      .map((a) => {
        const rest = { ...a };
        delete rest.grantTokenHash;
        return rest;
      });
  }
}
