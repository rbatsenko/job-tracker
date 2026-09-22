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
  profile=        engineering | design — OPTIONAL

Returns { jobs, facets, query }. "query" repeats what was applied, including
"scored": whether fit_score means anything on this response.

## Scores are off unless someone asks for them

Without a profile, every fit_score is 0 and "scored" is false. That is
deliberate: a ranking built from someone else's career looks authoritative and
is wrong, so the board shows none by default.

Two ways to get a ranking:
  GET  ...?profile=engineering        a preset
  POST ${base}/api/jobs               a profile of your own, in the body:

  { "profile": {
      "basedOn": "design",
      "coreStack": ["figma", "design systems"],
      "reach":  { "regions": ["eu"], "canWorkUS": false, "willRelocate": false },
      "money":  { "floor": 60000, "strong": 90000, "currency": "EUR" }
  } }

Geography is the heaviest term and comes from "reach", so ask the person where
they can work before ranking anything for them. Never assume they are in the
same place as whoever deployed this.

## Source

https://github.com/rbatsenko/job-tracker
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
