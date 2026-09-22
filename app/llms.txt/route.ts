import { isPersistent } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Written for an assistant, not for a crawler: what this app is, where the data
 * actually lives, and the exact shape to hand back so a person can load it.
 */
export function GET(request: Request) {
  const base = new URL(request.url).origin;
  const durable = isPersistent();

  const body = `# Job Tracker

A personal job-application tracker. Two pages:
  ${base}/        My jobs  — the jobs this person is pursuing
  ${base}/board   Find jobs — a catalogue scraped from 11 job boards

## Where the data lives — read this first

"My jobs" is stored in the person's own browser (localStorage, key
"job-tracker:my-jobs:v1"). It is NOT on the server. You cannot read or write it
over HTTP${durable ? " on a shared deployment" : ""}, and no API key will change
that. To work with someone's job list you need them to paste it to you.

${
  durable
    ? `This copy is running locally with a writable database, so here you CAN:
  GET  ${base}/api/my-jobs           -> { mode: "sqlite", jobs: [...] }
  POST ${base}/api/my-jobs           -> { jobs: [...] } upserts by id
`
    : `This copy has no writable storage, so ${base}/api/my-jobs returns
{ mode: "browser-only", jobs: [] }. That is expected, not an error.
`
}
## Helping someone with their job list

1. Ask them to open My jobs and press "Copy for Claude" (or "Export" for a file).
   They get a JSON document shaped like the schema below.
2. Read it, and do what they asked — rank the list, draft a message for one of
   them, spot what has gone quiet, suggest a follow-up.
3. If you changed anything, hand back the WHOLE document in the same shape.
   They press "Import", which merges on \`id\` and on \`origin\`, so editing an
   existing entry updates it rather than duplicating it.

Do not invent ids. Keep the ids you were given.

## The My jobs document

{
  "version": 1,
  "exported_at": "ISO-8601",
  "jobs": [
    {
      "id": "mj_...",                  // stable, keep it
      "origin": { "source": "...", "external_id": "...", "url": "..." } | null,
      "company": "string",             // required
      "title": "string",               // required
      "url": "string | null",
      "location": "string | null",
      "remote_scope": "worldwide | eu | pl | us | other | unknown | null",
      "salary_min": 0, "salary_max": 0,
      "currency": "USD | EUR | GBP | PLN | null",
      "salary_period": "year | month | hour | null",
      "tags": ["string"],
      "description": "string | null",
      "fit_score": 0,                  // 0-100, only if it came off the board
      "fit_reasons": ["string"],
      "status": "new | shortlist | drafted | applied | replied | interviewing | offer | rejected | archived",
      "starred": true,
      "notes": "string | null",
      "draft": "string | null",        // the message they will send
      "applied_at": "ISO-8601 | null",
      "next_action": "string | null",
      "created_at": "ISO-8601",
      "updated_at": "ISO-8601"
    }
  ]
}

## The board, which IS readable over HTTP

GET ${base}/api/jobs

  q=text          match company, title, tags, location
  scope=          reachable | worldwide | eu | pl | us | all
                  "reachable" means not US-only and not on-site
  source=         one board, or all
  minScore=0-100  fit score floor
  sort=           score | newest | company
  limit=25        default 25, max 1000
  full=1          include whole descriptions (large — the default truncates)

Returns { jobs, facets, query }. "query" repeats what was applied, so you can
tell a page from the whole set.

Scoring lives in lib/score.ts and is tuned to one person's profile
(lib/profile.ts): geography dominates, US-only roles are pushed down hard.
Treat fit_score as that person's opinion, not an objective ranking. It is
currently tuned for a software engineer, so it ranks design roles poorly.

## Source

https://github.com/rbatsenko/job-tracker
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
