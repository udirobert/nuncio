import { createClient, type Client } from "@libsql/client";
import type {
  ApprovalStatus,
  GovernanceApproval,
  GovernanceDecision,
  GovernanceRule,
  GovernanceStorageProvider,
} from "./types";

/**
 * Turso backing for the governance control plane. Three tables, one per
 * concept; `record_json` carries the full row so the schema stays narrow and
 * the TS types own the shape (same pattern as call_requests).
 */
export class TursoGovernanceStorageProvider implements GovernanceStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL is required for Turso governance storage");
    this.client = createClient({ url, authToken });
  }

  async listRules(): Promise<GovernanceRule[]> {
    await this.ensureSchema();
    const result = await this.client.execute(
      `SELECT record_json FROM governance_rules ORDER BY id`,
    );
    return result.rows.map((r) => JSON.parse(String(r.record_json)) as GovernanceRule);
  }

  async putRules(rules: GovernanceRule[]): Promise<void> {
    await this.ensureSchema();
    await this.client.batch(
      [
        { sql: `DELETE FROM governance_rules`, args: [] },
        ...rules.map((r) => ({
          sql: `INSERT INTO governance_rules (id, hook, enabled, record_json) VALUES (?, ?, ?, ?)`,
          args: [r.id, r.hook, r.enabled ? 1 : 0, JSON.stringify(r)],
        })),
      ],
      "write",
    );
  }

  async setRuleEnabled(id: string, enabled: boolean): Promise<void> {
    await this.ensureSchema();
    const existing = await this.client.execute({
      sql: `SELECT record_json FROM governance_rules WHERE id = ? LIMIT 1`,
      args: [id],
    });
    const row = existing.rows[0];
    if (!row) return;
    const rule = JSON.parse(String(row.record_json)) as GovernanceRule;
    rule.enabled = enabled;
    await this.client.execute({
      sql: `UPDATE governance_rules SET enabled = ?, record_json = ? WHERE id = ?`,
      args: [enabled ? 1 : 0, JSON.stringify(rule), id],
    });
  }

  async appendDecision(decision: GovernanceDecision): Promise<void> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO governance_audit (id, at, hook, tool, subject_class, workspace_id, decision, record_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        decision.id,
        decision.at,
        decision.hook,
        decision.tool,
        decision.subjectClass,
        decision.workspaceId ?? null,
        decision.decision,
        JSON.stringify(decision),
      ],
    });
  }

  async listDecisions(input: { workspaceId?: string; limit?: number }): Promise<GovernanceDecision[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM governance_audit
            ${input.workspaceId ? "WHERE workspace_id = ?" : ""}
            ORDER BY at DESC LIMIT ?`,
      args: input.workspaceId
        ? [input.workspaceId, input.limit ?? 100]
        : [input.limit ?? 100],
    });
    return result.rows.map((r) => JSON.parse(String(r.record_json)) as GovernanceDecision);
  }

  async createApproval(record: GovernanceApproval): Promise<GovernanceApproval> {
    await this.ensureSchema();
    await this.client.execute({
      sql: `INSERT INTO governance_approvals (id, workspace_id, status, created_at, expires_at, record_json)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [record.id, record.workspaceId, record.status, record.createdAt, record.expiresAt, JSON.stringify(record)],
    });
    return record;
  }

  async getApproval(id: string): Promise<GovernanceApproval | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM governance_approvals WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow<GovernanceApproval>(result.rows[0]?.record_json);
  }

  async decideApproval(
    id: string,
    next: GovernanceApproval,
    now = new Date(),
  ): Promise<GovernanceApproval | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `UPDATE governance_approvals SET status = ?, record_json = ?
            WHERE id = ? AND status = 'pending' AND expires_at > ?`,
      args: [next.status, JSON.stringify(next), id, now.toISOString()],
    });
    if (result.rowsAffected === 0) return null;
    const stored = next;
    await this.client.execute({
      sql: `UPDATE governance_approvals SET expires_at = ? WHERE id = ?`,
      args: [stored.expiresAt, id],
    });
    return next;
  }

  async consumeGrant(id: string, now = new Date()): Promise<GovernanceApproval | null> {
    await this.ensureSchema();
    const existing = await this.getApproval(id);
    if (
      !existing ||
      existing.status !== "approved" ||
      !existing.grantTokenHash ||
      (existing.grantExpiresAt && new Date(existing.grantExpiresAt).getTime() <= now.getTime())
    ) {
      return null;
    }
    const consumed = { ...existing, status: "consumed" as const };
    const result = await this.client.execute({
      sql: `UPDATE governance_approvals SET status = 'consumed', record_json = ?
            WHERE id = ? AND status = 'approved'`,
      args: [JSON.stringify(consumed), id],
    });
    return result.rowsAffected > 0 ? consumed : null;
  }

  async getApprovalByGrantHash(grantTokenHash: string): Promise<GovernanceApproval | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM governance_approvals
            WHERE json_extract(record_json,'$.grantTokenHash') = ? LIMIT 1`,
      args: [grantTokenHash],
    });
    return parseRow<GovernanceApproval>(result.rows[0]?.record_json);
  }

  async listApprovals(input: {
    workspaceId: string;
    status?: ApprovalStatus;
    limit?: number;
  }): Promise<Omit<GovernanceApproval, "grantTokenHash">[]> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM governance_approvals
            WHERE workspace_id = ? ${input.status ? "AND status = ?" : ""}
            ORDER BY created_at DESC LIMIT ?`,
      args: input.status
        ? [input.workspaceId, input.status, input.limit ?? 50]
        : [input.workspaceId, input.limit ?? 50],
    });
    return result.rows.map((r) => {
      const rest = JSON.parse(String(r.record_json)) as GovernanceApproval;
      delete rest.grantTokenHash;
      return rest;
    });
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS governance_rules (
            id TEXT PRIMARY KEY,
            hook TEXT NOT NULL,
            enabled INTEGER NOT NULL,
            record_json TEXT NOT NULL
          )
        `);
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS governance_audit (
            id TEXT PRIMARY KEY,
            at TEXT NOT NULL,
            hook TEXT NOT NULL,
            tool TEXT NOT NULL,
            subject_class TEXT NOT NULL,
            workspace_id TEXT,
            decision TEXT NOT NULL,
            record_json TEXT NOT NULL
          )
        `);
        await this.client.execute(`
          CREATE TABLE IF NOT EXISTS governance_approvals (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            record_json TEXT NOT NULL
          )
        `);
        await this.client.execute(
          `CREATE INDEX IF NOT EXISTS idx_governance_audit_ws ON governance_audit(workspace_id, at)`,
        );
        await this.client.execute(
          `CREATE INDEX IF NOT EXISTS idx_governance_approvals_ws ON governance_approvals(workspace_id, status)`,
        );
      })().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }
}

function parseRow<T>(value: unknown): T | null {
  if (!value) return null;
  return JSON.parse(String(value)) as T;
}
