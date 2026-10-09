/**
 * Governance control plane — operator CLI.
 *
 *   npx tsx scripts/governance.ts list              all rules (store is the policy)
 *   npx tsx scripts/governance.ts enable  <ruleId>  turn a rule on
 *   npx tsx scripts/governance.ts disable <ruleId>  turn a rule off
 *   npx tsx scripts/governance.ts add <file|->      add or replace a rule from JSON (- = stdin)
 *   npx tsx scripts/governance.ts remove <ruleId>   delete a rule from the store
 *   npx tsx scripts/governance.ts eval <tool>       dry-run a call against stored rules
 *        [--subject anonymous|member|agent] [--input '{"autoRender":true}']
 *   npx tsx scripts/governance.ts sync              add seed rules missing from the store
 *   npx tsx scripts/governance.ts reset             overwrite the store with policies.json
 *
 * Examples:
 *   npx tsx scripts/governance.ts disable pre.agent-render-needs-approval
 *     → fully autonomous renders (hybrid mode off)
 *   npx tsx scripts/governance.ts add ./credit-cap.json
 *     → e.g. { "id": "pre.credit-cap", "hook": "pre", "match": {"tool":"agent.*"},
 *              "conditions": [{"input":"estimatedCredits","operator":"exceeds","value":50}],
 *              "effect": "require_approval", "priority": 50, "enabled": true }
 *   npx tsx scripts/governance.ts eval agent.render --subject agent
 *     → prints the decision the live hook would return, without touching the store
 *   npx tsx scripts/governance.ts sync
 *     → pick up new seed rules after an upgrade without losing local edits
 *
 * Talks to the same storage factory as the app: Turso when
 * TURSO_DATABASE_URL is set, else .data/governance.json. Env is read from
 * .env.local / .env the way Next.js would (process env wins).
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { GovernanceRule, SubjectClass } from "../src/lib/governance/types";

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

    case "add": {
      if (!arg) throw new Error("add requires a JSON file path (or - for stdin)");
      const raw =
        arg === "-"
          ? await new Promise<string>((resolve) => {
              let buf = "";
              process.stdin.on("data", (c) => (buf += c));
              process.stdin.on("end", () => resolve(buf));
            })
          : readFileSync(path.resolve(arg), "utf8");
      const rule = JSON.parse(raw) as GovernanceRule;
      // Shape check — a malformed rule in the store makes every eval worse.
      const errs: string[] = [];
      if (!rule.id || typeof rule.id !== "string") errs.push("id (string)");
      if (!["access", "pre", "post"].includes(rule.hook)) errs.push("hook access|pre|post");
      if (!rule.match?.tool) errs.push("match.tool");
      if (!["allow", "deny", "redact", "require_approval"].includes(rule.effect)) {
        errs.push("effect allow|deny|redact|require_approval");
      }
      if (rule.hook === "post" && rule.effect === "redact" && !rule.redact?.patterns?.length) {
        errs.push("redact.patterns (non-empty) for post/redact rules");
      }
      if (typeof rule.priority !== "number") errs.push("priority (number)");
      if (errs.length) throw new Error(`rule is missing/invalid: ${errs.join(", ")}`);
      rule.enabled = rule.enabled !== false;
      const replaced = rules.some((r) => r.id === rule.id);
      await provider.putRules([...rules.filter((r) => r.id !== rule.id), rule]);
      console.log(`${replaced ? "Replaced" : "Added"} ${rule.id}`);
      print([rule]);
      break;
    }

    case "eval": {
      if (!arg) throw new Error("eval requires a tool name, e.g. agent.render");
      const flag = (name: string) => {
        const i = process.argv.indexOf(name);
        return i >= 0 ? process.argv[i + 1] : undefined;
      };
      const subjectClass = (flag("--subject") || "anonymous") as SubjectClass;
      const subject = {
        class: subjectClass,
        workspaceId: subjectClass === "anonymous" ? undefined : "eval",
        clientId: subjectClass === "anonymous" ? "eval" : undefined,
      };
      const inputs = flag("--input") ? JSON.parse(flag("--input")!) : {};
      if (rules.length === 0) {
        console.log("Store is empty — in the app it would seed from policies.json on first governed call.");
      }
      const { evaluateAccess, evaluatePre, evaluatePost } = await import(
        "../src/lib/governance/engine"
      );
      const access = evaluateAccess(rules, subject, arg);
      console.log(`access → ${access.decision}${access.ruleId ? ` (${access.ruleId})` : ""}${access.reason ? `: ${access.reason}` : ""}`);
      if (access.decision === "allow") {
        const pre = evaluatePre(rules, subject, arg, inputs);
        console.log(`pre    → ${pre.decision}${pre.ruleId ? ` (${pre.ruleId})` : ""}${pre.reason ? `: ${pre.reason}` : ""}`);
        const post = evaluatePost(rules, subject, arg, inputs);
        console.log(
          post.patternIds.length
            ? `post   → redact [${post.patternIds.join(", ")}]`
            : "post   → allow",
        );
      }
      break;
    }

    case "remove": {
      if (!arg) throw new Error("remove requires a rule id");
      if (!rules.some((r) => r.id === arg)) throw new Error(`rule not found: ${arg} (run 'list')`);
      await provider.putRules(rules.filter((r) => r.id !== arg));
      console.log(`Removed ${arg}`);
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
      console.log(__filename.split("/").pop() + " list|enable <id>|disable <id>|add <file|->|remove <id>|eval <tool> [--subject X] [--input JSON]|sync|reset");
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
