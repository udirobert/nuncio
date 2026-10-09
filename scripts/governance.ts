/**
 * Governance control plane — operator CLI.
 *
 *   npx tsx scripts/governance.ts list              all rules (store is the policy)
 *   npx tsx scripts/governance.ts enable  <ruleId>  turn a rule on
 *   npx tsx scripts/governance.ts disable <ruleId>  turn a rule off
 *   npx tsx scripts/governance.ts sync              add seed rules missing from the store
 *   npx tsx scripts/governance.ts reset             overwrite the store with policies.json
 *
 * Examples:
 *   npx tsx scripts/governance.ts disable pre.agent-render-needs-approval
 *     → fully autonomous renders (hybrid mode off)
 *   npx tsx scripts/governance.ts sync
 *     → pick up new seed rules after an upgrade without losing local edits
 *
 * Talks to the same storage factory as the app: Turso when
 * TURSO_DATABASE_URL is set, else .data/governance.json. Env is read from
 * .env.local / .env the way Next.js would (process env wins).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Minimal .env loading — enough for the storage factory's env vars.
for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const { getGovernanceStorageProvider } = await import("../src/lib/storage");
  const { default: policies } = await import("../src/lib/governance/policies.json");
  const provider = getGovernanceStorageProvider();
  const rules = await provider.listRules();

  const print = (list: typeof rules) => {
    for (const r of list.sort((a, b) => a.hook.localeCompare(b.hook) || b.priority - a.priority)) {
      console.log(
        `${r.enabled ? "on " : "OFF"}  ${r.hook.padEnd(6)} p${String(r.priority).padStart(3)}  ${r.id}  [${r.match.tool} → ${r.effect}]`,
      );
      if (r.description) console.log(`         ${r.description}`);
    }
  };

  switch (command) {
    case "list":
      if (rules.length === 0) {
        console.log("No rules in the store — they seed from policies.json on the app's first governed call.");
      } else {
        print(rules);
      }
      break;

    case "enable":
    case "disable": {
      if (!arg) throw new Error(`${command} requires a rule id`);
      const rule = rules.find((r) => r.id === arg);
      if (!rule) throw new Error(`rule not found: ${arg} (run 'list')`);
      await provider.setRuleEnabled(arg, command === "enable");
      console.log(`${command === "enable" ? "Enabled" : "Disabled"} ${arg} — live within ~2s of the next request`);
      break;
    }

    case "sync": {
      const existing = new Set(rules.map((r) => r.id));
      const missing = (policies.rules as typeof rules).filter((r) => !existing.has(r.id));
      if (missing.length === 0) {
        console.log("Store already has every seed rule.");
        break;
      }
      await provider.putRules([...rules, ...missing]);
      console.log(`Added ${missing.length} seed rule(s):`);
      print(missing);
      break;
    }

    case "reset": {
      await provider.putRules(policies.rules as typeof rules);
      console.log(`Store replaced with ${policies.rules.length} rules from policies.json.`);
      break;
    }

    default:
      console.log(__filename.split("/").pop() + " list|enable <id>|disable <id>|sync|reset");
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
