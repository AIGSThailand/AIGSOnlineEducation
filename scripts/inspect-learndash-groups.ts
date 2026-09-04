/**
 * Phase 5 CLI: inspect LearnDash groups (read-only).
 *
 *   npm run inspect:learndash-groups
 *   npm run inspect:learndash-groups -- --json
 */
import { inspectLearnDashGroups } from "../features/migration/learndash/inspect-groups";
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

async function main(): Promise<void> {
  try {
    const envName = parseEnvFlag(process.argv);
    const loaded = loadCliEnv(envName);
    console.log(`env file=${loaded.filePath} (--env ${envName})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const args = stripEnvArgs(process.argv.slice(2).filter((a) => a !== "--"));
  const jsonMode = args.includes("--json");

  console.log("dryRun/inspection only — no Supabase writes");
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error("LearnDash is not configured.");
    process.exit(1);
  }

  try {
    const inspection = await inspectLearnDashGroups();
    if (jsonMode) {
      console.log(
        JSON.stringify(
          {
            summary: inspection.proposed.summary,
            notes: inspection.proposed.notes,
            groups: inspection.proposed.groups,
            users: inspection.users,
          },
          null,
          2
        )
      );
      return;
    }
    console.log(inspection.report);
  } catch (err) {
    if (err instanceof LearnDashError) console.error(`[${err.code}] ${err.message}`);
    else console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
