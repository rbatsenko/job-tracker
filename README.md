# Job Tracker

One place for remote engineering roles that are actually open to someone in
Poland, scored against a profile you control, with the application status and
draft message kept next to each job.

```bash
npm install
npm run dev          # http://localhost:4321
```

Then press **Refresh boards**.

## What it does

- Pulls from six boards server-side, normalises them into one shape, and scores
  each role against `lib/profile.ts`.
- Reads the two boards that block servers (justjoin.it, Work at a Startup) from
  the browser — see `scripts/browser-snippets.md`.
- Tracks status (`new → shortlist → drafted → applied → replied → interviewing →
  offer / rejected`), a star, free notes, and the draft message per job.

## Sources

| Source | Reach | How |
| --- | --- | --- |
| `remoteok` | worldwide | public JSON API |
| `remotive` | worldwide | public JSON API |
| `himalayas` | worldwide, with location restrictions | public JSON API |
| `weworkremotely` | worldwide | RSS |
| `arbeitnow` | mostly Europe | public JSON API |
| `nofluffjobs` | Poland | search API |
| `justjoin` | Poland | browser snippet → `/import-bridge` |
| `ycombinator` | worldwide / US-only, flagged | browser snippet → `/import-bridge` |
| `manual` | anything | `scripts/add-job.mjs` |

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

It runs on Vercel as-is. There is no writable filesystem there, so `lib/db.ts`
falls back to an in-memory database: the catalogue becomes a per-instance cache
that **Refresh boards** repopulates, and everyone's tracking state stays in their
own browser. `data/jobs.db` is the durable copy, locally.

## Scripts

```bash
node scripts/add-job.mjs '{"url":"…","company":"…","title":"…","remote_scope":"eu","status":"applied"}'
node scripts/seed-shortlist.mjs      # re-applies data/seed-drafts.md
node scripts/export-snapshot.mjs 45  # data/snapshot.json, for sharing
```
