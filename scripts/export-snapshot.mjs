/**
 * Writes the shareable snapshot: the job catalogue without any personal
 * tracking state. Used to publish a read-only copy others can track in their
 * own browser.
 *
 *   node scripts/export-snapshot.mjs [minScore]
 */
import Database from "better-sqlite3";
import { writeFileSync } from "node:fs";
import path from "node:path";

const minScore = Number(process.argv[2] ?? 45);
const root = path.join(import.meta.dirname, "..");
const db = new Database(path.join(root, "data", "jobs.db"), { readonly: true });

const rows = db
  .prepare(
    `SELECT source, external_id, url, company, title, location, remote_scope,
            salary_min, salary_max, currency, salary_period, tags, fit_score,
            fit_reasons, posted_at, description
       FROM jobs
      WHERE fit_score >= ? AND remote_scope IN ('worldwide','eu','pl')
      ORDER BY fit_score DESC`,
  )
  .all(minScore);

const jobs = rows.map((r) => ({
  ...r,
  tags: JSON.parse(r.tags || "[]"),
  fit_reasons: JSON.parse(r.fit_reasons || "[]"),
  // Keep the payload small: the tracker links out for the full posting.
  description: r.description ? r.description.slice(0, 600) : null,
}));

const out = path.join(root, "data", "snapshot.json");
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), jobs }, null, 0));
console.log(`${jobs.length} jobs → data/snapshot.json (${(JSON.stringify(jobs).length / 1024).toFixed(0)} KB)`);
