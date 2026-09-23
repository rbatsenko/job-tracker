# Jobshelf

A small job-search tracker: keep the roles you're chasing in one place, and find
new remote ones without scrolling past boards that are half US-only.

**Live:** https://jobshelf.app. No sign-up. Your list stays in your browser.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57) ![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8)

## What it does

**My jobs** (`/`) is your pipeline. Paste a link from Greenhouse, Lever, Ashby or
any page with JobPosting data and the form fills itself in. Then move the job
through the stages (`new → shortlist → drafted → applied → replied → interviewing
→ offer`, plus `rejected` and `archived`), and keep notes and the message you plan
to send next to it.

**Find jobs** (`/board`) collects remote listings from six public job boards.
You can search and filter them, and **Add to my jobs** saves a copy of any listing.

**Ranking is off by default.** A score that fits someone else's career looks
precise and is wrong for you. Pick **Engineering** or **Design** for a one-click
ranking, or **Fine-tune** it: your skills, the countries you can work from, and
your salary floor. The profile stays in your browser and goes along with each
request; the server keeps nothing. Scoring lives in `lib/score.ts`, and where you
can work counts more than anything else.

## Run it

```bash
bun install
bun run dev        # http://localhost:4321
```

Locally, My jobs is also mirrored into SQLite (`data/jobs.db`), so scripts and
agents can read it:

```bash
curl localhost:4321/api/my-jobs                       # read
curl -X POST localhost:4321/api/my-jobs \
  -H 'content-type: application/json' -d @my-jobs.json # upsert an export
```

Bun is the package manager only. `better-sqlite3` is a native addon that crashes
under Bun's runtime, so don't run `bun --bun`. The `next` binary runs on Node.

## Where data lives

| | Where |
| --- | --- |
| Board listings | `data/jobs.db` locally; in memory on Vercel, refilled from the boards on a cold start |
| My jobs | `localStorage` in each browser, plus mirrored to SQLite when run locally |
| Ranking profile | `localStorage` |

With no accounts, everyone can share one deployment and keep their own list.
**Export** and **Import** move a list between devices, or between the deployed and
local copies. The **?** button on My jobs explains the file format.

## Working with an assistant

`/llms.txt` is written for LLMs. It explains that My jobs lives in the browser,
documents the file format and the board API, and asks assistants to credit
sources. **Copy for Claude** copies your list with short instructions attached.

> Read https://jobshelf.app/llms.txt and help me with my job search.

## API

```
GET  /api/jobs      q, scope, source, sort, profile, minScore, limit (25), full=1
POST /api/jobs      same query, with a custom { profile } in the body
POST /api/lookup    { url } turns a posting link into a prefilled job
GET  /api/my-jobs   local only
POST /api/my-jobs   local only, upserts by id
POST /api/refresh   { sources?, rescope? } pulls from the boards
```

## Sources

Only public APIs and feeds that their owners offer for reuse. Every listing links
back to the original posting and names the board it came from.

| Board | Feed | Their terms |
| --- | --- | --- |
| [Remote OK](https://remoteok.com) | JSON API | link back, credit Remote OK |
| [Remotive](https://remotive.com) | JSON API | link back, credit Remotive |
| [Himalayas](https://himalayas.app) | JSON API | link back, credit Himalayas |
| [Jobicy](https://jobicy.com) | JSON API | credit Jobicy, apply on the original |
| [Arbeitnow](https://www.arbeitnow.com) | JSON API | fair use, link back |
| [We Work Remotely](https://weworkremotely.com) | RSS | link back |

Some boards only allow reuse on their own site, so `/board` is marked `noindex`:
it's a personal tool, not a job site competing for search traffic. To add a board,
put a file in `lib/sources/` that returns `IncomingJob[]` and register it in
`lib/sources/index.ts` and `lib/sources/info.ts`. Check the board's terms and
`robots.txt` first.

## Deploying

```bash
vercel deploy --prod
```

Vercel has no writable disk, so `lib/db.ts` falls back to an in-memory database.
Upstream requests use the platform fetch cache (30 min), so refilling after a cold
start is cheap.

## Layout

```
app/            pages, API routes, llms.txt
components/     UI: add form, editor, custom select, theme toggle
lib/db.ts       SQLite schema and queries
lib/score.ts    ranking and location detection
lib/my-jobs.ts  the browser-side list: add, edit, sort, import/export
lib/sources/    one adapter per board
```

`data/` is gitignored, so your list, notes and drafts never reach the repo.
