import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AccountStorageProvider,
  AccountUser,
  CreditAccountSummary,
  CreditTransactionRecord,
  WorkspaceAccount,
} from "./types";

const DATA_DIR = process.env.NUNCIO_DATA_DIR || path.join(process.cwd(), ".data");
const BILLING_FILE = path.join(DATA_DIR, "billing.json");

interface BillingFile {
  users: AccountUser[];
  workspaces: WorkspaceAccount[];
  transactions: CreditTransactionRecord[];
}

export class FileAccountStorageProvider implements AccountStorageProvider {
  readonly name = "file";
  private data: BillingFile = { users: [], workspaces: [], transactions: [] };
  private loaded = false;

  async upsertUserByEmail(email: string, updates?: Partial<AccountUser>): Promise<AccountUser> {
    await this.load();
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date().toISOString();
    const existing = this.data.users.find((u) => u.email === normalizedEmail);

    if (existing) {
      Object.assign(existing, updates, { email: normalizedEmail, updatedAt: now });
      await this.persist();
      return existing;
    }

    const user: AccountUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      stripeCustomerId: updates?.stripeCustomerId,
      createdAt: now,
      updatedAt: now,
    };
    this.data.users.push(user);
    await this.persist();
    return user;
  }

  async getUserByEmail(email: string): Promise<AccountUser | null> {
    await this.load();
    const normalizedEmail = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email === normalizedEmail) || null;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<AccountUser | null> {
    await this.load();
    return this.data.users.find((u) => u.stripeCustomerId === customerId) || null;
  }

  async upsertWorkspaceForUser(user: AccountUser, updates?: Partial<WorkspaceAccount>): Promise<WorkspaceAccount> {
    await this.load();
    const now = new Date().toISOString();
    const existing = this.data.workspaces.find((w) => w.ownerUserId === user.id);

    if (existing) {
      Object.assign(existing, updates, { ownerUserId: user.id, updatedAt: now });
      await this.persist();
      return existing;
    }

    const workspace: WorkspaceAccount = {
      id: crypto.randomUUID(),
      ownerUserId: user.id,
      name: updates?.name || user.email,
      stripeCustomerId: updates?.stripeCustomerId,
      stripeSubscriptionId: updates?.stripeSubscriptionId,
      plan: updates?.plan || "free",
      createdAt: now,
      updatedAt: now,
    };
    this.data.workspaces.push(workspace);
    await this.persist();
    return workspace;
  }

  async getWorkspace(id: string): Promise<WorkspaceAccount | null> {
    await this.load();
    return this.data.workspaces.find((w) => w.id === id) || null;
  }

  async getWorkspaceByStripeCustomerId(customerId: string): Promise<WorkspaceAccount | null> {
    await this.load();
    return this.data.workspaces.find((w) => w.stripeCustomerId === customerId) || null;
  }

  async updateWorkspace(id: string, updates: Partial<WorkspaceAccount>): Promise<WorkspaceAccount | null> {
    await this.load();
    const workspace = this.data.workspaces.find((w) => w.id === id);
    if (!workspace) return null;
    Object.assign(workspace, updates, { updatedAt: new Date().toISOString() });
    await this.persist();
    return workspace;
  }

  async getCreditSummary(workspaceId: string): Promise<CreditAccountSummary | null> {
    await this.load();
    const workspace = this.data.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;
    const transactions = this.data.transactions.filter((t) => t.workspaceId === workspaceId);
    const balance = transactions.reduce((sum, transaction) => {
      if (transaction.type === "grant" || transaction.type === "refund" || transaction.type === "adjustment") {
        return sum + transaction.amount;
      }
      return sum - transaction.amount;
    }, 0);
    return { workspace, balance, transactions };
  }

  async appendCreditTransaction(input: Omit<CreditTransactionRecord, "id" | "createdAt">): Promise<CreditTransactionRecord> {
    await this.load();
    const transaction: CreditTransactionRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.transactions.push(transaction);
    await this.persist();
    return transaction;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      this.data = JSON.parse(await readFile(BILLING_FILE, "utf8")) as BillingFile;
    } catch {
      this.data = { users: [], workspaces: [], transactions: [] };
    }
  }

  private async persist(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(BILLING_FILE, JSON.stringify(this.data, null, 2), "utf8");
  }
}
