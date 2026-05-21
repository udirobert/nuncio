import { createClient, type Client } from "@libsql/client";
import type {
  AccountStorageProvider,
  AccountUser,
  CreditAccountSummary,
  CreditTransactionRecord,
  WorkspaceAccount,
} from "./types";

export class TursoAccountStorageProvider implements AccountStorageProvider {
  readonly name = "turso";
  private client: Client;
  private ready: Promise<void> | null = null;

  constructor() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL is required for Turso account storage");
    }

    this.client = createClient({ url, authToken });
  }

  async upsertUserByEmail(email: string, updates?: Partial<AccountUser>): Promise<AccountUser> {
    await this.ensureSchema();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.getUserByEmail(normalizedEmail);
    const now = new Date().toISOString();

    if (existing) {
      const updated = { ...existing, ...updates, email: normalizedEmail, updatedAt: now };
      await this.client.execute({
        sql: `UPDATE users SET record_json = ?, email = ?, stripe_customer_id = ?, updated_at = ? WHERE id = ?`,
        args: [JSON.stringify(updated), normalizedEmail, updated.stripeCustomerId || null, now, updated.id],
      });
      return updated;
    }

    const user: AccountUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      stripeCustomerId: updates?.stripeCustomerId,
      createdAt: now,
      updatedAt: now,
    };
    await this.client.execute({
      sql: `INSERT INTO users (id, email, stripe_customer_id, record_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [user.id, user.email, user.stripeCustomerId || null, JSON.stringify(user), now, now],
    });
    return user;
  }

  async getUserByEmail(email: string): Promise<AccountUser | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM users WHERE email = ? LIMIT 1`,
      args: [email.trim().toLowerCase()],
    });
    return parseRow<AccountUser>(result.rows[0]?.record_json);
  }

  async getUserByStripeCustomerId(customerId: string): Promise<AccountUser | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM users WHERE stripe_customer_id = ? LIMIT 1`,
      args: [customerId],
    });
    return parseRow<AccountUser>(result.rows[0]?.record_json);
  }

  async upsertWorkspaceForUser(user: AccountUser, updates?: Partial<WorkspaceAccount>): Promise<WorkspaceAccount> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM workspaces WHERE owner_user_id = ? LIMIT 1`,
      args: [user.id],
    });
    const existing = parseRow<WorkspaceAccount>(result.rows[0]?.record_json);
    const now = new Date().toISOString();

    if (existing) {
      const updated = { ...existing, ...updates, ownerUserId: user.id, updatedAt: now };
      await this.client.execute({
        sql: `UPDATE workspaces SET owner_user_id = ?, stripe_customer_id = ?, record_json = ?, updated_at = ? WHERE id = ?`,
        args: [user.id, updated.stripeCustomerId || null, JSON.stringify(updated), now, updated.id],
      });
      return updated;
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
    await this.client.execute({
      sql: `INSERT INTO workspaces (id, owner_user_id, stripe_customer_id, record_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [workspace.id, user.id, workspace.stripeCustomerId || null, JSON.stringify(workspace), now, now],
    });
    return workspace;
  }

  async getWorkspace(id: string): Promise<WorkspaceAccount | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM workspaces WHERE id = ? LIMIT 1`,
      args: [id],
    });
    return parseRow<WorkspaceAccount>(result.rows[0]?.record_json);
  }

  async getWorkspaceByStripeCustomerId(customerId: string): Promise<WorkspaceAccount | null> {
    await this.ensureSchema();
    const result = await this.client.execute({
      sql: `SELECT record_json FROM workspaces WHERE stripe_customer_id = ? LIMIT 1`,
      args: [customerId],
    });
    return parseRow<WorkspaceAccount>(result.rows[0]?.record_json);
  }

  async updateWorkspace(id: string, updates: Partial<WorkspaceAccount>): Promise<WorkspaceAccount | null> {
    const existing = await this.getWorkspace(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.client.execute({
      sql: `UPDATE workspaces SET stripe_customer_id = ?, record_json = ?, updated_at = ? WHERE id = ?`,
      args: [updated.stripeCustomerId || null, JSON.stringify(updated), updated.updatedAt, id],
    });
    return updated;
  }

  async getCreditSummary(workspaceId: string): Promise<CreditAccountSummary | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return null;
    const result = await this.client.execute({
      sql: `SELECT record_json FROM credit_transactions WHERE workspace_id = ? ORDER BY created_at ASC`,
      args: [workspaceId],
    });
    const transactions = result.rows
      .map((row) => parseRow<CreditTransactionRecord>(row.record_json))
      .filter((row): row is CreditTransactionRecord => Boolean(row));
    const balance = transactions.reduce((sum, transaction) => {
      if (transaction.type === "grant" || transaction.type === "refund" || transaction.type === "adjustment") {
        return sum + transaction.amount;
      }
      return sum - transaction.amount;
    }, 0);
    return { workspace, balance, transactions };
  }

  async appendCreditTransaction(input: Omit<CreditTransactionRecord, "id" | "createdAt">): Promise<CreditTransactionRecord> {
    await this.ensureSchema();
    const transaction: CreditTransactionRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await this.client.execute({
      sql: `INSERT INTO credit_transactions (id, workspace_id, type, amount, record_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        transaction.id,
        transaction.workspaceId,
        transaction.type,
        transaction.amount,
        JSON.stringify(transaction),
        transaction.createdAt,
      ],
    });
    return transaction;
  }

  private async ensureSchema(): Promise<void> {
    if (!this.ready) {
      this.ready = Promise.all([
        this.client.execute(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            stripe_customer_id TEXT,
            record_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        this.client.execute(`
          CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT,
            stripe_customer_id TEXT,
            record_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        this.client.execute(`
          CREATE TABLE IF NOT EXISTS credit_transactions (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            record_json TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        `),
      ]).then(() => undefined);
    }

    return this.ready;
  }
}

function parseRow<T>(value: unknown): T | null {
  if (!value) return null;
  return JSON.parse(String(value)) as T;
}
