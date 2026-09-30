import { afterEach, describe, expect, it, vi } from "vitest";

interface FakeClient {
  execute: (input: string | { sql: string; args?: unknown[] }) => Promise<unknown>;
}

interface SchemaProvider {
  get: (id: string) => Promise<unknown>;
  client: FakeClient;
}

function sqlOf(input: string | { sql: string }): string {
  return typeof input === "string" ? input : input.sql;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each([
  {
    name: "TursoCallRequestStorageProvider",
    table: "call_requests",
    load: async () =>
      new (await import("./turso-call-request-provider")).TursoCallRequestStorageProvider() as unknown as SchemaProvider,
  },
  {
    name: "TursoLiveSessionStorageProvider",
    table: "live_sessions",
    load: async () =>
      new (await import("./turso-live-session-provider")).TursoLiveSessionStorageProvider() as unknown as SchemaProvider,
  },
])("$name schema init", ({ table, load }) => {
  it("starts the index statement only after the table statement resolves", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://unit-test.invalid");
    const provider = await load();

    const calls: string[] = [];
    let resolveTable: (value: { rows: unknown[] }) => void = () => {};
    const client = provider.client;
    client.execute = vi.fn(async (input) => {
      const sql = sqlOf(input);
      calls.push(sql);
      if (sql.includes("CREATE TABLE")) {
        return new Promise<{ rows: unknown[] }>((resolve) => {
          resolveTable = resolve;
        });
      }
      return { rows: [] };
    });

    const op = provider.get("any-id");
    await vi.waitFor(() => {
      expect(calls.some((sql) => sql.includes(`CREATE TABLE`) && sql.includes(table))).toBe(true);
    });
    await Promise.resolve();
    // A concurrent Promise.all would already have issued CREATE INDEX here —
    // the dependency must be sequential because the index requires the table.
    expect(calls.some((sql) => sql.includes("CREATE INDEX"))).toBe(false);

    resolveTable({ rows: [] });
    await op;
    const indexAt = calls.findIndex((sql) => sql.includes("CREATE INDEX"));
    const tableAt = calls.findIndex((sql) => sql.includes("CREATE TABLE"));
    expect(indexAt).toBeGreaterThan(tableAt);
  });

  it("retries schema init after a failure instead of caching the rejection", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://unit-test.invalid");
    const provider = await load();

    let failures = 0;
    const client = provider.client;
    client.execute = vi.fn(async (input) => {
      const sql = sqlOf(input);
      if (sql.includes("CREATE TABLE") && failures === 0) {
        failures += 1;
        throw new Error("transient init failure");
      }
      return { rows: [] };
    });

    await expect(provider.get("any-id")).rejects.toThrow("transient init failure");
    await expect(provider.get("any-id")).resolves.toBeNull();
    expect(failures).toBe(1);
  });
});
