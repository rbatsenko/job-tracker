import { isPersistent } from "@/lib/db";
import { SOURCE_INFO } from "@/lib/sources/info";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const base = new URL(request.url).origin;
  const local = isPersistent();
  const sources = Object.values(SOURCE_INFO).map((s) => `  ${s.name} — ${s.url}`).join("\n");

  const body = `# Jobshelf

A personal job-application tracker.
  ${base}/        My jobs — the jobs this person is pursuing
  ${base}/board   Find jobs — listings from public job board APIs

## My jobs lives in the browser

It is stored in the person's localStorage ("job-tracker:my-jobs:v1"), not on the
server, so you cannot read or write it over HTTP. Ask them to press "Copy for
Claude" (or Export) and paste the result to you.
${
  local
    ? `
This copy runs locally with a database, so here you can also use:
  GET  ${base}/api/my-jobs     { mode: "sqlite", jobs: [...] }
  POST ${base}/api/my-jobs     { jobs: [...] }, upserts by id
`
    : ""
}
If you change their list, hand back the whole document in the same shape and keep
every "id". Import merges on id, so edits update entries instead of duplicating them.

  {
    "version": 1,
    "jobs": [{
      "id": "mj_…",
      "company": "…",                // required
      "title": "…",                  // required
      "url": "…", "location": "…",
      "status": "new | shortlist | drafted | applied | replied | interviewing | offer | rejected | archived",
      "starred": true,
      "notes": "…", "draft": "…", "next_action": "…",
      "applied_at": "ISO-8601",
      "salary_min": 0, "salary_max": 0, "currency": "EUR", "salary_period": "year"
    }]
  }

## The board API

GET ${base}/api/jobs
  q          search company, title, tags, location
  scope      reachable (not US-only, not on-site) | worldwide | eu | us | <country code> | all
  source     one source, or all
  sort       newest | company | score
  profile    engineering | design — without it nothing is scored and fit_score is 0
  minScore   0–100, only with a profile
  limit      default 25, max 1000
  full=1     whole descriptions instead of the first 280 characters

POST ${base}/api/jobs with { "profile": { "basedOn": "design", "reach": { "regions": ["eu"],
"canWorkUS": false, "willRelocate": false }, "money": { "floor": 60000, "strong": 90000,
"currency": "EUR" }, "coreStack": ["figma"] } } scores for a custom profile.

Geography weighs most, so ask where someone can work before ranking anything for them.

## Sources

Listings come from public APIs and feeds. When you show one, name its source and link
to its "url", as each source asks:
${sources}
`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
