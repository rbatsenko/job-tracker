/**
 * Loads a My Jobs export into the local database — the other half of the round
 * trip between the shared deployment and a local copy.
 *
 *   node scripts/import-my-jobs.mjs data/my-jobs-import.json
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";

const file = process.argv[2] ?? path.join(import.meta.dirname, "..", "data", "my-jobs-import.json");
const root = path.join(import.meta.dirname, "..");
const parsed = JSON.parse(readFileSync(file, "utf8"));
const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs ?? []);

const db = new Database(path.join(root, "data", "jobs.db"));
db.exec(readFileSync(path.join(root, "scripts", "my-jobs.sql"), "utf8"));

const stmt = db.prepare(`
  INSERT INTO my_jobs (id, origin_source, origin_id, company, title, url, location,
    remote_scope, salary_min, salary_max, currency, salary_period, tags, description,
    fit_score, fit_reasons, status, starred, notes, draft, applied_at, next_action,
    created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET
    status=excluded.status, starred=excluded.starred, notes=excluded.notes,
    draft=excluded.draft, applied_at=excluded.applied_at,
    next_action=excluded.next_action, updated_at=excluded.updated_at
`);

const now = new Date().toISOString();
let n = 0;
db.transaction(() => {
  for (const j of jobs) {
    if (!j.id || !j.company || !j.title) continue;
    stmt.run(
      j.id, j.origin?.source ?? null, j.origin?.external_id ?? null, j.company, j.title,
      j.url ?? null, j.location ?? null, j.remote_scope ?? null, j.salary_min ?? null,
      j.salary_max ?? null, j.currency ?? null, j.salary_period ?? null,
      JSON.stringify(j.tags ?? []), j.description ?? null, j.fit_score ?? null,
      JSON.stringify(j.fit_reasons ?? []), j.status ?? "shortlist", j.starred ? 1 : 0,
      j.notes ?? null, j.draft ?? null, j.applied_at ?? null, j.next_action ?? null,
      j.created_at ?? now, j.updated_at ?? now,
    );
    n++;
  }
})();

console.log(`imported ${n} jobs into data/jobs.db (my_jobs)`);
