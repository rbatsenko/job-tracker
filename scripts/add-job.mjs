/**
 * Adds a job the crawlers can't see — something a friend sent you, or a
 * company careers page — and optionally sets where you are with it.
 *
 *   node scripts/add-job.mjs '{"url":"…","company":"…","title":"…","remote_scope":"eu","status":"applied"}'
 */
import Database from "better-sqlite3";
import path from "node:path";

const input = JSON.parse(process.argv[2] ?? "{}");
if (!input.url || !input.company || !input.title) {
  console.error("Need at least { url, company, title }");
  process.exit(1);
}

const base = process.env.TRACKER_URL ?? "http://localhost:4321";
const external_id = input.external_id ?? input.url.split("/").filter(Boolean).pop();

const res = await fetch(`${base}/api/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jobs: [{ source: input.source ?? "manual", external_id, ...input, status: undefined }],
  }),
});
console.log("import:", await res.json());

if (input.status || input.notes) {
  const db = new Database(path.join(import.meta.dirname, "..", "data", "jobs.db"));
  db.prepare(
    `UPDATE jobs SET status = COALESCE(?, status), notes = COALESCE(?, notes),
       applied_at = CASE WHEN ? = 'applied' THEN ? ELSE applied_at END, starred = 1, updated_at = ?
     WHERE source = ? AND external_id = ?`,
  ).run(
    input.status ?? null,
    input.notes ?? null,
    input.status ?? null,
    new Date().toISOString(),
    new Date().toISOString(),
    input.source ?? "manual",
    external_id,
  );
  console.log(`set status=${input.status ?? "-"}`);
}
