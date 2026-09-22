# Seed drafts (example)

`scripts/seed-shortlist.mjs` reads `data/seed-drafts.md` — your own copy, which
is gitignored — and attaches each draft to the matching job, marking it
`shortlist` and starred.

Blocks are separated by `---`. The heading must contain the job's id as
`jobs/<id>` (the Work at a Startup URL); everything after the heading is the
draft.

```markdown
## 1. Acme (W21) — Senior Frontend Engineer — Warsaw, PL / Remote — jobs/12345
Hi — I'm a senior engineer based in Kraków, so Warsaw/remote works well.

The part of your post about product thinking is what made me apply. At <company>
I built <the specific thing>, which <the measurable result>.

Portfolio: example.com

---
## 2. Beta (S24) — Backend Engineer — Munich / Remote — jobs/67890
…
```
