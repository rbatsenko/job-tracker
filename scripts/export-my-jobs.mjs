/**
 * Lifts everything you were actually tracking out of the catalogue database and
 * writes it in My Jobs format, ready to load with Import on the My Jobs page.
 *
 * Needed because My Jobs now lives in the browser: the status, notes and drafts
 * currently sitting in data/jobs.db columns have no other way across.
 *
 *   node scripts/export-my-jobs.mjs [outfile]
 */
import Database from "better-sqlite3";
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const out = process.argv[2] ?? path.join(root, "data", "my-jobs-import.json");
const db = new Database(path.join(root, "data", "jobs.db"), { readonly: true });

// Anything you touched: moved off 'new', starred, wrote a note or a draft.
const rows = db
  .prepare(
    `SELECT * FROM jobs
      WHERE status != 'new'
         OR starred = 1
         OR (draft IS NOT NULL AND length(trim(draft)) > 0)
         OR (notes IS NOT NULL AND length(trim(notes)) > 0)
      ORDER BY starred DESC, fit_score DESC`,
  )
  .all();

const now = new Date().toISOString();

const jobs = rows.map((r) => ({
  id: `mj_${r.source}_${r.external_id}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120),
  origin: { source: r.source, external_id: r.external_id, url: r.url },
  company: r.company,
  title: r.title,
  url: r.url,
  location: r.location,
  remote_scope: r.remote_scope,
  salary_min: r.salary_min,
  salary_max: r.salary_max,
  currency: r.currency,
  salary_period: r.salary_period,
  tags: JSON.parse(r.tags || "[]"),
  description: r.description,
  fit_score: r.fit_score,
  fit_reasons: JSON.parse(r.fit_reasons || "[]"),
  status: r.status === "new" ? "shortlist" : r.status,
  starred: Boolean(r.starred),
  notes: r.notes,
  draft: r.draft,
  applied_at: r.applied_at,
  next_action: null,
  created_at: r.discovered_at ?? now,
  updated_at: r.updated_at ?? now,
}));

writeFileSync(out, JSON.stringify({ version: 1, exported_at: now, jobs }, null, 2));

console.log(`${jobs.length} tracked jobs -> ${path.relative(root, out)}`);
for (const j of jobs) {
  const bits = [
    j.status,
    j.starred ? "starred" : null,
    j.draft ? `draft ${j.draft.length}ch` : null,
    j.notes ? "notes" : null,
  ].filter(Boolean);
  console.log(`  ${j.company} — ${j.title}  [${bits.join(", ")}]`);
}
