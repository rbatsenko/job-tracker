/**
 * Seeds the Work at a Startup shortlist: marks the seven roles we picked by
 * hand and attaches the drafts written for each. Safe to re-run.
 *
 *   node scripts/seed-shortlist.mjs
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const md = readFileSync(path.join(root, "data", "seed-drafts.md"), "utf8");
const db = new Database(path.join(root, "data", "jobs.db"));

// Each block starts "## N. Company — Role — … — jobs/<id>" and the draft is
// everything up to the next "---" separator.
const blocks = md.split(/\n---\n/).filter((b) => /jobs\/\d+/.test(b));

const update = db.prepare(
  `UPDATE jobs SET status = 'shortlist', starred = 1, draft = ?, updated_at = ?
   WHERE source = 'ycombinator' AND external_id = ?`,
);

let applied = 0;
for (const block of blocks) {
  const id = block.match(/jobs\/(\d+)/)?.[1];
  if (!id) continue;
  const lines = block.split("\n");
  const headingAt = lines.findIndex((l) => l.startsWith("## "));
  const draft = lines
    .slice(headingAt + 1)
    .join("\n")
    .replace(/\[stretch[^\]]*\]/gi, "")
    .trim();
  const res = update.run(draft, new Date().toISOString(), id);
  if (res.changes) applied++;
  else console.warn(`  ! job ${id} not in the database yet`);
}

console.log(`Seeded ${applied} of ${blocks.length} shortlisted roles.`);
