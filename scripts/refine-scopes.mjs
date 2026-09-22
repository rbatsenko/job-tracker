/**
 * Re-reads remote_scope from each job's stored location.
 *
 * Only ever makes a scope *more* specific: an existing 'us' is left alone,
 * because that verdict came from the board's own visa flag which the location
 * string does not carry. Run after changing inferScope().
 *
 *   node scripts/refine-scopes.mjs [--dry]
 */
import Database from "better-sqlite3";
import path from "node:path";
import { inferScope } from "./_scope.mjs";

const dry = process.argv.includes("--dry");
const db = new Database(path.join(import.meta.dirname, "..", "data", "jobs.db"));
const rows = db.prepare(`SELECT id, location, remote_scope FROM jobs`).all();
const update = db.prepare(`UPDATE jobs SET remote_scope = ? WHERE id = ?`);

let changed = 0;
const moves = {};
const tx = db.transaction(() => {
  for (const r of rows) {
    if (r.remote_scope === "us") continue; // trust the visa flag over the string
    const next = inferScope(r.location);
    const better =
      (r.remote_scope === "unknown" && next !== "unknown") ||
      (r.remote_scope === "worldwide" && (next === "pl" || next === "eu"));
    if (!better) continue;
    moves[`${r.remote_scope} → ${next}`] = (moves[`${r.remote_scope} → ${next}`] ?? 0) + 1;
    changed++;
    if (!dry) update.run(next, r.id);
  }
});
tx();

console.log(dry ? `would change ${changed}` : `changed ${changed}`);
for (const [k, v] of Object.entries(moves)) console.log(`  ${k}: ${v}`);
