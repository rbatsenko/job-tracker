# Job Tracker

One place for remote engineering roles that are actually open to someone in
Poland, scored against a profile you control, with the application status and
draft message kept next to each job.

**Live:** https://job-tracker-three-livid.vercel.app

```bash
bun install
bun run dev          # http://localhost:4321
```

Then press **Refresh boards**.

## What it does

- Pulls from nine boards server-side, normalises them into one shape, and scores
  each role against `lib/profile.ts`.
- Reads boards that need a login (Work at a Startup) from the browser — see
  `scripts/browser-snippets.md`.
- Tracks status (`new → shortlist → drafted → applied → replied → interviewing →
  offer / rejected`), a star, free notes, and the draft message per job.

## Sources

Nine boards answer a plain server-side request and are pulled by **Refresh
boards**. Work at a Startup needs your login, so it comes in through a browser
snippet — see `scripts/browser-snippets.md`.

| Source | Reach | How |
| --- | --- | --- |
| `justjoin` | Poland | `justjoin.it/api/candidate-api/offers` (`from`/`itemsCount`, not `page`) |
| `nofluffjobs` | Poland | search API |
| `landingjobs` | Europe | public JSON API, salaries usually published |
| `arbeitnow` | Europe (DACH-heavy) | public JSON API |
| `remoteok` | worldwide | public JSON API |
| `remotive` | worldwide | public JSON API |
| `jobicy` | worldwide | public JSON API |
| `himalayas` | worldwide, with location restrictions | public JSON API |
| `weworkremotely` | worldwide | RSS |
| `ycombinator` | worldwide / US-only, flagged | browser snippet → `/import-bridge` |
| `manual` | anything | `scripts/add-job.mjs` |

Adding one is a file in `lib/sources/` that returns `IncomingJob[]`, plus a line
in `lib/sources/index.ts`. Everything else — scoring, dedup, the UI — follows.

## Scoring

`lib/score.ts` starts every job at 28 and adjusts:

- **Geography dominates.** Worldwide `+22`, Europe `+20`, Poland `+18`,
  on-site elsewhere `−12`, US-only `−35`. A perfect role you cannot legally take
  should not sit at the top of the list.
- **Stack** up to `+34`, weighted towards the core (TypeScript, React, Node,
  React Native) over the secondary (Kotlin, Spring, Kafka…) and topical bonuses
  (AI, MCP, integrations).
- **Thin listings** — a one-line tagline rather than a description — are scored
  from title and tags blended with a neutral prior, so a terse Work at a Startup
  row is not ranked below a verbose one purely for being terse.
- **Title** up to `+8`; off-profile titles (embedded, ML, DevOps, sales…) `−25` each.
- **Pay** `+6` when the top of the band is strong, `−8` when it is low for senior.
- **Staffing marketplaces** (Lemon.io, Proxify, Toptal…) `−14`, because you are
  placed with a client rather than joining a product team.

Edit `lib/profile.ts`, then rescore everything already stored:

```bash
curl -X POST localhost:4321/api/refresh -H 'content-type: application/json' -d '{"sources":[],"rescore":true}'
```

## Where the data lives

- **The catalogue** is SQLite at `data/jobs.db` (gitignored).
- **Your tracking state** — status, star, notes, draft — is written to
  `localStorage` first and mirrored to SQLite when it is writable. That is what
  makes the app shareable: several people can use the same deployment and each
  keeps their own state, with no accounts and no shared database.

## Deploying

```bash
vercel deploy --prod
```

Vercel picks up `bun.lock` and installs with Bun.

There is no writable filesystem on Vercel, so `lib/db.ts` falls back to an
in-memory database and the catalogue becomes a per-instance cache. `/api/jobs`
fills it on the first request to each cold instance, and upstream fetches use
the platform fetch cache (30 min) so that refill costs one round of cheap,
shared requests rather than a full re-crawl.

What this means in practice:

- **Sharing works without accounts.** Everyone who opens the deployment gets the
  same catalogue and keeps their own status, notes and drafts in their own
  browser. Nothing you type is sent anywhere.
- **`localStorage` is per-browser.** It does not follow you to another device,
  and clearing site data clears it. `data/jobs.db` on your own machine is the
  durable copy — run locally if the history matters to you.
- **Work at a Startup roles are local-only.** They arrive through the browser
  bridge, so they live in whichever instance received them. Import them into
  your local copy, not the deployment.

## A note on Bun

Bun is the package manager and script runner here: `bun install` and `bun run dev`
both work, and `bun.lock` is the committed lockfile.

Do **not** run anything that loads `better-sqlite3` on Bun's *runtime*. It is a
native N-API addon and Bun panics on it (`NAPI FATAL ERROR: Error::New`). That
means:

- `bun install`, `bun run dev`, `bun run build` — fine. The `next` binary carries
  a `#!/usr/bin/env node` shebang, so Bun only launches it and Next runs on Node.
- `bun --bun next dev` — crashes.
- `bun scripts/*.mjs` — crashes. The scripts in `scripts/` open the database
  directly, so run them with `node`.

## Scripts

```bash
node scripts/add-job.mjs '{"url":"…","company":"…","title":"…","remote_scope":"eu","status":"applied"}'
node scripts/seed-shortlist.mjs      # re-applies data/seed-drafts.md
node scripts/export-snapshot.mjs 45  # data/snapshot.json, for sharing
```
