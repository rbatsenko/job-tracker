# Jobshelf

A small job-search tracker: keep the roles you're chasing in one place, and find
new remote ones without scrolling past boards that are half US-only.

**Live:** https://jobshelf.app. No sign-up. Your list stays in your browser.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57) ![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8)

## What it does

**My jobs** (`/`) is your pipeline. Paste a link to a posting and the form fills
in the company, role and location. That works for Greenhouse, Lever, Ashby and
Traffit postings, for company careers pages that embed one of those, and for any
page with schema.org JobPosting data or a sensible page title. Then move the job
through the stages (`new → shortlist → drafted → applied → replied → interviewing
→ offer`, plus `rejected` and `archived`), and keep notes and the message you plan
to send next to it.

**Find jobs** (`/board`) collects remote listings from six public job boards,
in any field: engineering, design, product, data, marketing, sales, support,
people, finance and operations. Each listing is sorted into a field by its title
(`lib/fields.ts`), so you can filter to yours. **Add to my jobs** saves a copy of
any listing.

**Ranking is off by default.** A score that fits someone else's career looks
precise and is wrong for you. Pick your field under **Rank for** for a one-click
ranking, or **Fine-tune** it: your skills, the countries you can work from, and
your salary floor. The profile stays in your browser and goes along with each
request; the server keeps nothing. Scoring lives in `lib/score.ts`: where you can
work counts most, then whether the title is in your field, then your skills.

## Run it

```bash
bun install
bun run dev        # http://localhost:4321
```

Bun is the package manager only. `better-sqlite3` is a native addon that crashes
under Bun's runtime, so don't run `bun --bun`. The `next` binary runs on Node.

## Where data lives

| | Where |
| --- | --- |
| Board listings | `data/jobs.db` locally; in memory on Vercel, refilled from the boards on a cold start |
| My jobs | `localStorage` in each browser; also mirrored into `data/jobs.db` when run locally |
| Synced copy | Vercel Blob, encrypted in the browser with the sync code (see below) |
| Ranking profile | `localStorage` |

With no accounts, everyone can share one deployment and keep their own list.
**Export** and **Import** move a list between devices, or between the deployed and
local copies. The **?** button on My jobs explains the file format.

## Sync without an account

**Sync** on My jobs creates a 20-character code. Type it into Jobshelf on another
device and the two lists merge and stay in step: after every change, and whenever
a tab comes back into view. The code is the only secret:

- The browser derives an AES-256 key from the code (PBKDF2) and encrypts the whole
  list before upload. The server never sees the code or the plaintext.
- The storage id is a separate hash of the code, so knowing where a blob lives
  tells you nothing about the key, and blobs can't be listed.
- Merging is per job: the newer copy wins, and deletions are remembered for 90
  days so a removed job doesn't come back from the other device.

The store is a private Vercel Blob bucket. Sync switches itself off when
`BLOB_READ_WRITE_TOKEN` isn't set, so a local copy works without it (`vercel env
pull` brings the token in if you want it locally). Losing the code means losing
the synced copy, but never the list in your browser.

## Working with an AI assistant

Two ways, and they work with ChatGPT, Claude or whatever you use.

**Copy for AI** on My jobs copies your whole list with short instructions
attached. Paste it into a chat and ask for a ranking, a draft message, or a
cleaned-up list. If the assistant hands the list back, save it as a file and
**Import** it. Jobs are matched by `id`, so edits update rather than duplicate.

**`/llms.txt`** is for assistants that can read the web. It explains that My jobs
lives in the browser, documents the file format and the API below, and asks them
to credit the job boards.

> Read https://jobshelf.app/llms.txt and help me with my job search.

## API

The pages talk to a few JSON endpoints, and an assistant can use the same ones
to search the board or fill in a job from a link.

```
GET  /api/jobs      search the board: q, scope, source, field, sort, limit (25), offset, full=1
                    add profile=<field> to get a ranking
POST /api/jobs      same, with a custom { profile } in the body
POST /api/lookup    { url } turns a posting link into a prefilled job
POST /api/refresh   { sources?, rescope? } pulls fresh listings from the boards
GET  /api/my-jobs   your list, only when running locally
POST /api/my-jobs   upsert into it by id, only when running locally
DELETE /api/my-jobs { ids }, only when running locally
GET  /api/sync      ?id=<sha256> returns the encrypted blob; without id, { available }
PUT  /api/sync      { id, iv, data } stores one; DELETE { id } removes it
```

On jobshelf.app `/api/my-jobs` answers `{ mode: "browser-only" }`: the list is in
your browser and the server never sees it. When you run the app locally, the list
is also mirrored into `data/jobs.db`, and these two endpoints read and write it.
That's how a local agent or script can work on your list directly:

```bash
curl localhost:4321/api/my-jobs
curl -X POST localhost:4321/api/my-jobs -H 'content-type: application/json' -d @my-jobs.json
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
lib/fields.ts   the fields: title words, skills, presets
lib/score.ts    ranking and location detection
lib/my-jobs.ts  the browser-side list: add, edit, sort, merge, import/export
lib/sync.ts     encryption and the sync code
lib/sources/    one adapter per board
```

`data/` is gitignored, so your list, notes and drafts never reach the repo.
