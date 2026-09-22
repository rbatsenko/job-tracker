# Job Tracker

Keep track of the jobs you are actually chasing, and find new ones without
wading through boards that are half US-only.

**Live:** https://jobshelf.vercel.app

```bash
bun install
bun run dev          # http://localhost:4321
```

## Two pages

**My jobs** (`/`) is the point of the thing. Add a job by hand — a link a friend
sent, a careers page, a recruiter email — edit every field, delete it, move it
through the stages, and keep the message you plan to send next to it.

**Find jobs** (`/board`) is the feeder: ~1,700 listings pulled from ten boards,
searchable and filterable, with **Add to my jobs** on every row. Adding takes a
full snapshot, so a tracked job survives the catalogue being rebuilt.

Stages run `new → shortlist → drafted → applied → replied → interviewing →
offer`, with `rejected` and `archived` for the ones that end.

## Ranking is off until you ask for it

By default the board shows no scores: newest first, plain filters. A ranking
built from someone else's career looks authoritative and is wrong, so the shared
deployment does not impose one.

**Rank for · Nothing | Engineering | Design** gives you a ranking in one click.
**Fine-tune** opens a short form — what you do, which skills count, where you can
work, the lowest salary worth your time. It lives in your browser and is sent
with each request; nothing about it is stored on the server.

`lib/score.ts` starts a job at 28 and adjusts:

- **Geography dominates**, and comes from *your* settings, not the code.
  Worldwide `+22`; a country you picked `+20`; inside Europe when you said Europe
  `+16`; US-only `+20` if you can take it, `−35` if you cannot; on-site outside
  your reach `−12`. A role you cannot legally take should not top the list.
- **Stack** up to `+34`, weighted to your core skills over secondary ones.
- **Title must name the family**, or `−14`. A design studio hiring a Shopify
  developer reads as a design role from its description alone.
- **Thin listings** — a tagline rather than a description — are scored from title
  and tags blended with a neutral prior, so a terse row is not ranked below a
  verbose one purely for being terse.
- **Off-profile titles** `−25` each; **pay** `±6–8` against your floor;
  **staffing marketplaces** (Lemon.io, Proxify, Toptal…) `−14`.

Presets live in `lib/profile.ts`. Editing them changes what "Engineering" and
"Design" mean for everyone; scores are computed per request, so there is nothing
to migrate.

## Countries

`lib/countries.ts` knows 64 countries by name, major city and uppercase code, and
which are EU/EEA. A listing's `remote_scope` is `worldwide`, `eu`, `us`, `other`,
`unknown`, or a country code such as `pl` or `de`.

After teaching it a new country, re-read the stored locations:

```bash
curl -X POST localhost:4321/api/refresh -H 'content-type: application/json' \
  -d '{"sources":[],"rescope":true}'
```

## Sources

Nine boards answer a plain server request and are pulled by **Fetch new jobs**.
Work at a Startup needs your login, so it arrives through a browser snippet —
see `scripts/browser-snippets.md`.

| Source | Reach | How |
| --- | --- | --- |
| `justjoin` | Poland | `justjoin.it/api/candidate-api/offers` — pages on `from`/`itemsCount`; `page`/`perPage` are accepted and silently ignored |
| `nofluffjobs` | Poland | search API, engineering and design queries |
| `landingjobs` | Europe | public JSON API, salaries usually published |
| `arbeitnow` | Europe (DACH-heavy) | public JSON API |
| `remoteok` | worldwide | public JSON API |
| `remotive` | worldwide | public JSON API, `software-dev` + `devops` + `design` |
| `jobicy` | worldwide | public JSON API, `engineering` + `design-multimedia` (plain `design` returns nothing) |
| `himalayas` | worldwide | public JSON API — **cursor** paging; it caps a page at 20 rows whatever `limit` says |
| `weworkremotely` | worldwide | RSS, programming + design feeds |
| `ycombinator` | worldwide / US-only, flagged | browser snippet → `/import-bridge` |
| `manual` | anything | `node scripts/add-job.mjs` |

Adding one is a file in `lib/sources/` returning `IncomingJob[]`, plus a line in
`lib/sources/index.ts`. Scoring, dedup and the UI follow.

The ingest gate in `lib/sources/util.ts` is the **union** of every profile's
keywords. Filtering it by one person's stack is what previously threw away every
design role before it was stored.

## Where the data lives

| | Where | Survives |
| --- | --- | --- |
| The catalogue | `data/jobs.db`, or memory on Vercel | Rebuilt freely from the boards |
| My jobs | `localStorage` in each person's browser | Until they clear site data |
| My jobs, locally | mirrored into `my_jobs` in `data/jobs.db` | Properly |

My jobs is browser-owned on purpose: several people share one deployment, each
keeping their own list, with no accounts and no database. The cost is that it
does not follow you between devices — **Export** is how you move it, and how you
back it up.

`/` → **?** explains all of this in the app, including the file shape Import
expects.

## Working with an assistant

`GET /llms.txt` is written for one. It states that My jobs lives in the browser
and cannot be fetched over HTTP, gives the document schema, and documents the
board API. Point a friend's Claude at it:

> Read https://jobshelf.vercel.app/llms.txt and help me with my job search.

**Copy for Claude** on My jobs copies your list with a short brief attached, so
pasting it is enough on its own. If it hands back an edited list, save it and use
**Import** — merging is by `id` and by `origin`, so editing an existing job
updates it rather than duplicating it.

## API

```
GET  /api/jobs          q, scope, source, sort, minScore, limit (25), full=1,
                        profile=engineering|design
POST /api/jobs          same, with a whole custom profile in the body
GET  /api/my-jobs       local runs only; { mode: "browser-only" } elsewhere
POST /api/my-jobs       upsert, local runs only
POST /api/refresh       { sources?, rescore?, rescope? }
POST /api/import        { source, rows } from the browser bridge
```

`GET /api/jobs` defaults to 25 rows with truncated descriptions. It used to
return every row in full — 1.27 MB, which no assistant can read. The response
echoes `query`, including `scored`, so a caller knows whether the numbers mean
anything.

## Deploying

```bash
vercel deploy --prod
```

Vercel picks up `bun.lock` and installs with Bun. There is no writable
filesystem there, so `lib/db.ts` falls back to an in-memory database and the
catalogue becomes a per-instance cache. `/api/jobs` fills it on the first request
to each cold instance, and upstream fetches use the platform fetch cache
(30 min), so a refill is one round of cheap shared requests rather than a full
re-crawl.

Work at a Startup roles are local-only: they arrive through the browser bridge,
so they live in whichever instance received them. Import them into your local
copy, not the deployment.

## A note on Bun

Bun is the package manager and script runner; `bun.lock` is committed.

Do **not** run anything that loads `better-sqlite3` on Bun's *runtime*. It is a
native N-API addon and Bun panics on it (`NAPI FATAL ERROR: Error::New`).

- `bun install`, `bun run dev`, `bun run build` — fine. The `next` binary carries
  a `#!/usr/bin/env node` shebang, so Bun only launches it and Next runs on Node.
- `bun --bun next dev` — crashes.
- `bun scripts/*.mjs` — crashes. Those scripts open the database directly, so run
  them with `node`.

## Scripts

```bash
node scripts/add-job.mjs '{"url":"…","company":"…","title":"…","status":"applied"}'
node scripts/export-my-jobs.mjs      # tracked jobs → data/my-jobs-import.json
node scripts/import-my-jobs.mjs FILE # a My jobs export → local SQLite
node scripts/seed-shortlist.mjs      # re-applies data/seed-drafts.md
node scripts/export-snapshot.mjs 45  # data/snapshot.json, for sharing
```

Everything under `data/` is gitignored except the example. Your job list, drafts
and notes stay on your machine.
