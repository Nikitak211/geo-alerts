/**
 * CLI entry for replay: single alert or date range.
 * Usage:
 *   node dist/replay/replayRunner.js --id=ALERT_ID [--save]
 *   node dist/replay/replayRunner.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--save]
 */

import * as path from "path";
import { replayAlert } from "./replayAlert";
import { replayDateRange } from "./replayDateRange";

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

async function main(): Promise<void> {
  const id = getArg("id");
  const from = getArg("from");
  const to = getArg("to");
  const save = hasFlag("save");

  // Load pool from server src (runner runs from dist/replay)
  const poolModule = path.join(__dirname, "..", "..", "src", "db", "pool");
  const { pool } = require(poolModule);

  const geojsonPath = path.join(process.cwd(), "municipalities.geojson");

  if (id) {
    const result = await replayAlert(id, {
      pool,
      geojsonPath,
      saveArtifacts: save ? true : false,
    });
    if (!result) {
      console.error("Alert not found:", id);
      process.exit(1);
    }
    console.log(JSON.stringify({ comparison: result.comparison, artifactsPath: result.artifactsPath }, null, 2));
    return;
  }

  if (from && to) {
    const result = await replayDateRange({
      pool,
      from,
      to,
      geojsonPath,
      saveArtifacts: save ? true : false,
    });
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.artifactsDir) console.log("Artifacts dir:", result.artifactsDir);
    return;
  }

  console.error("Usage:");
  console.error("  node dist/replay/replayRunner.js --id=ALERT_ID [--save]");
  console.error("  node dist/replay/replayRunner.js --from=YYYY-MM-DD --to=YYYY-MM-DD [--save]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
