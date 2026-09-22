import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { scoreJob } from "./score";
import type { IncomingJob, Job, Status } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "jobs.db");

let _db: Database.Database | null = null;
let _persistent = false;

/**
 * True when jobs are on disk; false when we fell back to memory (e.g. Vercel).
 *
 * Opens the database first: the flag is only set by db(), so asking before any
 * query would always answer false and wrongly report a local run as ephemeral.
 */
export const isPersistent = () => {
  db();
  return _persistent;
};

export function db(): Database.Database {
  if (_db) return _db;

  // Locally this writes data/jobs.db. On a read-only host such as Vercel the
  // open fails, and an in-memory database keeps the API working as a cache —
  // per-viewer tracking state lives in localStorage on the client either way.
  try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const d = new Database(DB_PATH);
    d.pragma("journal_mode = WAL");
    d.exec(SCHEMA);
    _db = d;
    _persistent = true;
  } catch {
    const d = new Database(":memory:");
    d.exec(SCHEMA);
    _db = d;
    _persistent = false;
  }
  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT    NOT NULL,
  external_id   TEXT    NOT NULL,
  url           TEXT    NOT NULL,
  company       TEXT    NOT NULL,
  company_url   TEXT,
  title         TEXT    NOT NULL,
  location      TEXT,
  remote_scope  TEXT    NOT NULL DEFAULT 'unknown',
  employment    TEXT,
  salary_min    INTEGER,
  salary_max    INTEGER,
  currency      TEXT,
  salary_period TEXT,
  tags          TEXT    NOT NULL DEFAULT '[]',
  description   TEXT,
  posted_at     TEXT,
  discovered_at TEXT    NOT NULL,
  fit_score     INTEGER NOT NULL DEFAULT 0,
  fit_reasons   TEXT    NOT NULL DEFAULT '[]',
  status        TEXT    NOT NULL DEFAULT 'new',
  starred       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  draft         TEXT,
  applied_at    TEXT,
  updated_at    TEXT    NOT NULL,
  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_score  ON jobs(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);

CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  at     TEXT    NOT NULL,
  kind   TEXT    NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_job ON events(job_id);

CREATE TABLE IF NOT EXISTS my_jobs (
  id            TEXT PRIMARY KEY,
  origin_source TEXT,
  origin_id     TEXT,
  company       TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  location      TEXT,
  remote_scope  TEXT,
  salary_min    INTEGER,
  salary_max    INTEGER,
  currency      TEXT,
  salary_period TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  description   TEXT,
  fit_score     INTEGER,
  fit_reasons   TEXT NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'shortlist',
  starred       INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  draft         TEXT,
  applied_at    TEXT,
  next_action   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_my_jobs_status ON my_jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_my_jobs_origin
  ON my_jobs(origin_source, origin_id) WHERE origin_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS runs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  at       TEXT NOT NULL,
  source   TEXT NOT NULL,
  found    INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  error    TEXT
);
`;

type Row = Omit<Job, "tags" | "fit_reasons"> & { tags: string; fit_reasons: string };

const hydrate = (r: Row): Job => ({
  ...r,
  tags: JSON.parse(r.tags || "[]"),
  fit_reasons: JSON.parse(r.fit_reasons || "[]"),
});

/**
 * Inserts new jobs and refreshes the volatile fields of ones already seen.
 * Anything the user owns — status, notes, draft, starred — is never touched.
 */
export function upsertJobs(incoming: IncomingJob[]): { inserted: number; updated: number } {
  const d = db();
  const now = new Date().toISOString();

  const insert = d.prepare(`
    INSERT INTO jobs (source, external_id, url, company, company_url, title, location,
      remote_scope, employment, salary_min, salary_max, currency, salary_period, tags,
      description, posted_at, discovered_at, fit_score, fit_reasons, updated_at)
    VALUES (@source, @external_id, @url, @company, @company_url, @title, @location,
      @remote_scope, @employment, @salary_min, @salary_max, @currency, @salary_period, @tags,
      @description, @posted_at, @discovered_at, @fit_score, @fit_reasons, @updated_at)
    ON CONFLICT(source, external_id) DO UPDATE SET
      url          = excluded.url,
      title        = excluded.title,
      location     = excluded.location,
      remote_scope = excluded.remote_scope,
      salary_min   = excluded.salary_min,
      salary_max   = excluded.salary_max,
      currency     = excluded.currency,
      tags         = excluded.tags,
      description  = COALESCE(excluded.description, jobs.description),
      fit_score    = excluded.fit_score,
      fit_reasons  = excluded.fit_reasons,
      updated_at   = excluded.updated_at
  `);

  const exists = d.prepare(`SELECT 1 FROM jobs WHERE source = ? AND external_id = ?`);
  let inserted = 0;
  let updated = 0;

  const tx = d.transaction((items: IncomingJob[]) => {
    for (const j of items) {
      const isNew = !exists.get(j.source, String(j.external_id));
      const { score, reasons } = scoreJob(j);
      insert.run({
        source: j.source,
        external_id: String(j.external_id),
        url: j.url,
        company: j.company,
        company_url: j.company_url ?? null,
        title: j.title,
        location: j.location ?? null,
        remote_scope: j.remote_scope ?? "unknown",
        employment: j.employment ?? null,
        salary_min: j.salary_min ?? null,
        salary_max: j.salary_max ?? null,
        currency: j.currency ?? null,
        salary_period: j.salary_period ?? null,
        tags: JSON.stringify(j.tags ?? []),
        description: j.description ?? null,
        posted_at: j.posted_at ?? null,
        discovered_at: now,
        fit_score: score,
        fit_reasons: JSON.stringify(reasons),
        updated_at: now,
      });
      if (isNew) inserted++;
      else updated++;
    }
  });

  tx(incoming);

  return { inserted, updated };
}

export type JobFilter = {
  status?: string;
  source?: string;
  scope?: string;
  q?: string;
  minScore?: number;
  sort?: "score" | "newest" | "company";
  /** Whose taste to score with. Scores are never stored per viewer. */
  profile?: string;
  limit?: number;
  /** Descriptions are most of the bytes; only send them when asked. */
  full?: boolean;
};

export function listJobs(f: JobFilter = {}): Job[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.status && f.status !== "all") {
    if (f.status === "open") where.push(`status NOT IN ('rejected','archived')`);
    else {
      where.push(`status = @status`);
      params.status = f.status;
    }
  }
  if (f.source && f.source !== "all") {
    where.push(`source = @source`);
    params.source = f.source;
  }
  if (f.scope && f.scope !== "all") {
    if (f.scope === "reachable") where.push(`remote_scope IN ('worldwide','eu','pl')`);
    else {
      where.push(`remote_scope = @scope`);
      params.scope = f.scope;
    }
  }
  if (f.q) {
    where.push(`(company LIKE @q OR title LIKE @q OR tags LIKE @q OR location LIKE @q)`);
    params.q = `%${f.q}%`;
  }

  const order =
    f.sort === "newest"
      ? `COALESCE(posted_at, discovered_at) DESC`
      : f.sort === "company"
        ? `company COLLATE NOCASE ASC`
        : `COALESCE(posted_at, discovered_at) DESC`;

  // Scoring happens here rather than in SQL, because the score depends on who
  // is looking. Re-ranking ~1000 rows in memory is cheap; baking one person's
  // taste into a shared column is not.
  const sql = `SELECT * FROM jobs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT 4000`;
  const rows = (db().prepare(sql).all(params) as Row[]).map(hydrate);

  const scored = rows.map((job) => {
    const { score, reasons } = scoreJob({ ...job, tags: job.tags }, f.profile);
    return { ...job, fit_score: score, fit_reasons: reasons };
  });

  const min = f.minScore ?? 0;
  const filtered = min > 0 ? scored.filter((j) => j.fit_score >= min) : scored;

  if (f.sort !== "newest" && f.sort !== "company") {
    filtered.sort((a, b) => b.fit_score - a.fit_score);
  }

  const limit = Math.min(Math.max(f.limit ?? 25, 1), 1000);
  return filtered.slice(0, limit).map((job) => ({
    ...job,
    description: f.full ? job.description : job.description ? job.description.slice(0, 280) : null,
  }));
}

export function getJob(id: number): Job | null {
  const r = db().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as Row | undefined;
  return r ? hydrate(r) : null;
}

const EDITABLE = ["status", "starred", "notes", "draft", "applied_at"] as const;

export function updateJob(id: number, patch: Record<string, unknown>): Job | null {
  const d = db();
  const before = getJob(id);
  if (!before) return null;

  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const key of EDITABLE) {
    if (!(key in patch)) continue;
    sets.push(`${key} = @${key}`);
    params[key] = patch[key] ?? null;
  }
  // Stamp the application date the first time something is marked applied.
  if (patch.status === "applied" && !before.applied_at && !("applied_at" in patch)) {
    sets.push(`applied_at = @applied_at`);
    params.applied_at = new Date().toISOString();
  }
  if (!sets.length) return before;

  sets.push(`updated_at = @updated_at`);
  params.updated_at = new Date().toISOString();

  d.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = @id`).run(params);

  if (patch.status && patch.status !== before.status) {
    d.prepare(`INSERT INTO events (job_id, at, kind, detail) VALUES (?, ?, ?, ?)`).run(
      id,
      new Date().toISOString(),
      "status",
      `${before.status} → ${patch.status as Status}`,
    );
  }
  return getJob(id);
}

export function facets() {
  const d = db();
  return {
    sources: d
      .prepare(`SELECT source, COUNT(*) AS n FROM jobs GROUP BY source ORDER BY n DESC`)
      .all() as { source: string; n: number }[],
    statuses: d
      .prepare(`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status`)
      .all() as { status: string; n: number }[],
    total: (d.prepare(`SELECT COUNT(*) AS n FROM jobs`).get() as { n: number }).n,
  };
}

export function recordRun(source: string, found: number, inserted: number, error?: string) {
  db()
    .prepare(`INSERT INTO runs (at, source, found, inserted, error) VALUES (?, ?, ?, ?, ?)`)
    .run(new Date().toISOString(), source, found, inserted, error ?? null);
}

/** Re-runs the scorer over everything already stored, after a profile tweak. */
export function rescoreAll(): number {
  const d = db();
  const rows = d.prepare(`SELECT * FROM jobs`).all() as Row[];
  const stmt = d.prepare(`UPDATE jobs SET fit_score = ?, fit_reasons = ? WHERE id = ?`);
  const tx = d.transaction(() => {
    for (const r of rows) {
      const job = hydrate(r);
      const { score, reasons } = scoreJob({ ...job, tags: job.tags });
      stmt.run(score, JSON.stringify(reasons), job.id);
    }
  });
  tx();
  return rows.length;
}


// ------------------------------------------------------------------ my_jobs
//
// The personal tracker lives in each viewer's browser. This table is the
// durable copy that exists only when the app runs somewhere with a writable
// filesystem — which is what lets a locally-run agent read and edit the list.
// On a read-only host isPersistent() is false and callers are expected to say
// so rather than write into a database that vanishes.

export type MyJobRow = {
  id: string;
  origin_source: string | null;
  origin_id: string | null;
  company: string;
  title: string;
  url: string | null;
  location: string | null;
  remote_scope: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_period: string | null;
  tags: string[];
  description: string | null;
  fit_score: number | null;
  fit_reasons: string[];
  status: string;
  starred: 0 | 1;
  notes: string | null;
  draft: string | null;
  applied_at: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

const hydrateMine = (r: Record<string, unknown>): MyJobRow => ({
  ...(r as unknown as MyJobRow),
  tags: JSON.parse((r.tags as string) || "[]"),
  fit_reasons: JSON.parse((r.fit_reasons as string) || "[]"),
  starred: (r.starred ? 1 : 0) as 0 | 1,
});

export function listMyJobs(): MyJobRow[] {
  return (
    db()
      .prepare(`SELECT * FROM my_jobs ORDER BY starred DESC, updated_at DESC`)
      .all() as Record<string, unknown>[]
  ).map(hydrateMine);
}

/** Bulk upsert, used by both the browser mirror and the CLI importer. */
export function saveMyJobs(jobs: Partial<MyJobRow>[]): { saved: number } {
  const d = db();
  const stmt = d.prepare(`
    INSERT INTO my_jobs (id, origin_source, origin_id, company, title, url, location,
      remote_scope, salary_min, salary_max, currency, salary_period, tags, description,
      fit_score, fit_reasons, status, starred, notes, draft, applied_at, next_action,
      created_at, updated_at)
    VALUES (@id, @origin_source, @origin_id, @company, @title, @url, @location,
      @remote_scope, @salary_min, @salary_max, @currency, @salary_period, @tags, @description,
      @fit_score, @fit_reasons, @status, @starred, @notes, @draft, @applied_at, @next_action,
      @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      company = excluded.company, title = excluded.title, url = excluded.url,
      location = excluded.location, remote_scope = excluded.remote_scope,
      salary_min = excluded.salary_min, salary_max = excluded.salary_max,
      currency = excluded.currency, salary_period = excluded.salary_period,
      tags = excluded.tags, description = excluded.description,
      fit_score = excluded.fit_score, fit_reasons = excluded.fit_reasons,
      status = excluded.status, starred = excluded.starred, notes = excluded.notes,
      draft = excluded.draft, applied_at = excluded.applied_at,
      next_action = excluded.next_action, updated_at = excluded.updated_at
  `);

  const nowIso = new Date().toISOString();
  let saved = 0;
  const tx = d.transaction((items: Partial<MyJobRow>[]) => {
    for (const j of items) {
      if (!j.id || !j.company || !j.title) continue;
      stmt.run({
        id: j.id,
        origin_source: j.origin_source ?? null,
        origin_id: j.origin_id ?? null,
        company: j.company,
        title: j.title,
        url: j.url ?? null,
        location: j.location ?? null,
        remote_scope: j.remote_scope ?? null,
        salary_min: j.salary_min ?? null,
        salary_max: j.salary_max ?? null,
        currency: j.currency ?? null,
        salary_period: j.salary_period ?? null,
        tags: JSON.stringify(j.tags ?? []),
        description: j.description ?? null,
        fit_score: j.fit_score ?? null,
        fit_reasons: JSON.stringify(j.fit_reasons ?? []),
        status: j.status ?? "shortlist",
        starred: j.starred ? 1 : 0,
        notes: j.notes ?? null,
        draft: j.draft ?? null,
        applied_at: j.applied_at ?? null,
        next_action: j.next_action ?? null,
        created_at: j.created_at ?? nowIso,
        updated_at: j.updated_at ?? nowIso,
      });
      saved++;
    }
  });
  tx(jobs);
  return { saved };
}

export function deleteMyJob(id: string): boolean {
  return db().prepare(`DELETE FROM my_jobs WHERE id = ?`).run(id).changes > 0;
}
