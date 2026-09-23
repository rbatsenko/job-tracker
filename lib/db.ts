import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fieldOf } from "./fields";
import { inferScope, scoreJob } from "./score";
import { MAX_LIMIT, type IncomingJob, type Job } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "jobs.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  url           TEXT NOT NULL,
  company       TEXT NOT NULL,
  company_url   TEXT,
  title         TEXT NOT NULL,
  location      TEXT,
  remote_scope  TEXT NOT NULL DEFAULT 'unknown',
  field         TEXT NOT NULL DEFAULT 'other',
  employment    TEXT,
  salary_min    INTEGER,
  salary_max    INTEGER,
  currency      TEXT,
  salary_period TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  description   TEXT,
  posted_at     TEXT,
  discovered_at TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE(source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);

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
`;

let instance: Database.Database | null = null;
let persistent = false;

/**
 * A file locally. On a read-only host like Vercel the open fails and we fall back to
 * memory: the catalogue becomes a per-instance cache, and My jobs lives in the browser anyway.
 */
export function db(): Database.Database {
  if (instance) return instance;
  try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    instance = new Database(DB_PATH);
    instance.pragma("journal_mode = WAL");
    persistent = true;
  } catch {
    instance = new Database(":memory:");
    persistent = false;
  }
  instance.exec(SCHEMA);
  migrate(instance);
  return instance;
}

/** Columns added after the first release. */
function migrate(d: Database.Database) {
  const columns = (d.pragma("table_info(jobs)") as { name: string }[]).map((c) => c.name);
  if (!columns.includes("field")) {
    d.exec(`ALTER TABLE jobs ADD COLUMN field TEXT NOT NULL DEFAULT 'other'`);
    reclassifyAll(d);
  }
}

export const isPersistent = () => (db(), persistent);

const now = () => new Date().toISOString();

// ---------------------------------------------------------------- catalogue

export function upsertJobs(incoming: IncomingJob[]) {
  const d = db();
  const exists = d.prepare(`SELECT 1 FROM jobs WHERE source = ? AND external_id = ?`);
  const upsert = d.prepare(`
    INSERT INTO jobs (source, external_id, url, company, company_url, title, location, remote_scope,
      field, employment, salary_min, salary_max, currency, salary_period, tags, description, posted_at,
      discovered_at, updated_at)
    VALUES (@source, @external_id, @url, @company, @company_url, @title, @location, @remote_scope,
      @field, @employment, @salary_min, @salary_max, @currency, @salary_period, @tags, @description, @posted_at,
      @at, @at)
    ON CONFLICT(source, external_id) DO UPDATE SET
      url = excluded.url, company = excluded.company, company_url = excluded.company_url,
      title = excluded.title, location = excluded.location, remote_scope = excluded.remote_scope,
      field = excluded.field, employment = excluded.employment, salary_min = excluded.salary_min,
      salary_max = excluded.salary_max, currency = excluded.currency, salary_period = excluded.salary_period,
      tags = excluded.tags, description = COALESCE(excluded.description, jobs.description),
      posted_at = COALESCE(excluded.posted_at, jobs.posted_at), updated_at = excluded.updated_at
  `);

  let inserted = 0;
  const at = now();
  d.transaction(() => {
    for (const j of incoming) {
      const id = String(j.external_id);
      if (!exists.get(j.source, id)) inserted++;
      upsert.run({
        company_url: null, location: null, employment: null, salary_min: null, salary_max: null,
        currency: null, salary_period: null, description: null, posted_at: null,
        ...j,
        external_id: id,
        remote_scope: j.remote_scope ?? "unknown",
        field: fieldOf(j.title),
        tags: JSON.stringify(j.tags ?? []),
        at,
      });
    }
  })();
  return { inserted, updated: incoming.length - inserted };
}

export type JobFilter = {
  q?: string;
  source?: string;
  scope?: string;
  /** A key from lib/fields.ts. */
  field?: string;
  sort?: "score" | "newest" | "company";
  /** A preset name or a full profile. Without one, nothing is scored. */
  profile?: string | object;
  minScore?: number;
  limit?: number;
  offset?: number;
  full?: boolean;
};

/** `matched` is the count before limit and offset, so a caller can page through the rest. */
export function listJobs(f: JobFilter = {}): { jobs: Job[]; matched: number } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (f.source && f.source !== "all") {
    where.push(`source = @source`);
    params.source = f.source;
  }
  if (f.field && f.field !== "all") {
    where.push(`field = @field`);
    params.field = f.field;
  }
  if (f.scope === "reachable") {
    where.push(`remote_scope != 'us'`);
  } else if (f.scope && f.scope !== "all") {
    where.push(`remote_scope = @scope`);
    params.scope = f.scope;
  }
  if (f.q) {
    where.push(`(company LIKE @q OR title LIKE @q OR tags LIKE @q OR location LIKE @q)`);
    params.q = `%${f.q}%`;
  }

  const order = f.sort === "company" ? `company COLLATE NOCASE` : `COALESCE(posted_at, discovered_at) DESC`;
  const rows = db()
    .prepare(`SELECT * FROM jobs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order}`)
    .all(params) as (Omit<Job, "tags"> & { tags: string })[];

  let jobs: Job[] = rows.map((r) => {
    const job = { ...r, tags: JSON.parse(r.tags) as string[] };
    const { score, reasons } = f.profile ? scoreJob(job, f.profile) : { score: 0, reasons: [] };
    return { ...job, fit_score: score, fit_reasons: reasons };
  });

  if (f.profile) {
    if (f.minScore) jobs = jobs.filter((j) => j.fit_score >= f.minScore!);
    if (f.sort !== "newest" && f.sort !== "company") jobs.sort((a, b) => b.fit_score - a.fit_score);
  }

  const limit = Math.min(Math.max(f.limit ?? 25, 1), MAX_LIMIT);
  const offset = Math.max(f.offset ?? 0, 0);
  const page = jobs.slice(offset, offset + limit).map((j) => ({
    ...j,
    description: f.full || !j.description ? j.description : j.description.slice(0, 280),
  }));
  return { jobs: page, matched: jobs.length };
}

export function facets() {
  const d = db();
  return {
    sources: d.prepare(`SELECT source, COUNT(*) AS n FROM jobs GROUP BY source ORDER BY n DESC`).all() as {
      source: string;
      n: number;
    }[],
    fields: d.prepare(`SELECT field, COUNT(*) AS n FROM jobs GROUP BY field ORDER BY n DESC`).all() as {
      field: string;
      n: number;
    }[],
    total: (d.prepare(`SELECT COUNT(*) AS n FROM jobs`).get() as { n: number }).n,
  };
}

/** Re-reads every title, for when the field lists change. */
export function reclassifyAll(d = db()) {
  const rows = d.prepare(`SELECT id, title, field FROM jobs`).all() as { id: number; title: string; field: string }[];
  const update = d.prepare(`UPDATE jobs SET field = ? WHERE id = ?`);
  let changed = 0;
  d.transaction(() => {
    for (const r of rows) {
      const next = fieldOf(r.title);
      if (next !== r.field) {
        update.run(next, r.id);
        changed++;
      }
    }
  })();
  return { changed };
}

/** Re-reads every job's location after inferScope learns something new. "us" came from a board's own flag, so it stays. */
export function rescopeAll() {
  const d = db();
  const rows = d.prepare(`SELECT id, location, remote_scope FROM jobs WHERE remote_scope != 'us'`).all() as {
    id: number;
    location: string | null;
    remote_scope: string;
  }[];
  const update = d.prepare(`UPDATE jobs SET remote_scope = ? WHERE id = ?`);

  let changed = 0;
  d.transaction(() => {
    for (const r of rows) {
      const next = inferScope(r.location);
      if (next !== "unknown" && next !== r.remote_scope) {
        update.run(next, r.id);
        changed++;
      }
    }
  })();
  return { changed };
}

// ---------------------------------------------------------------- my jobs

/** Local-only mirror of the browser's My jobs, so a local agent can read and edit it. */
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
  starred: boolean;
  notes: string | null;
  draft: string | null;
  applied_at: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

export function listMyJobs(): MyJobRow[] {
  const rows = db().prepare(`SELECT * FROM my_jobs ORDER BY updated_at DESC`).all() as Record<string, unknown>[];
  return rows.map((r) => ({
    ...(r as MyJobRow),
    tags: JSON.parse(r.tags as string),
    fit_reasons: JSON.parse(r.fit_reasons as string),
    starred: Boolean(r.starred),
  }));
}

const MY_JOB_FIELDS = [
  "origin_source", "origin_id", "url", "location", "remote_scope", "salary_min", "salary_max",
  "currency", "salary_period", "description", "fit_score", "notes", "draft", "applied_at", "next_action",
] as const;

export function saveMyJobs(jobs: Partial<MyJobRow>[]) {
  const d = db();
  const columns = ["id", "company", "title", ...MY_JOB_FIELDS, "tags", "fit_reasons", "status", "starred", "created_at", "updated_at"];
  const updates = columns.filter((c) => c !== "id" && c !== "created_at").map((c) => `${c} = excluded.${c}`);
  const upsert = d.prepare(`
    INSERT INTO my_jobs (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})
    ON CONFLICT(id) DO UPDATE SET ${updates.join(", ")}
  `);

  let saved = 0;
  d.transaction(() => {
    for (const j of jobs) {
      if (!j.id || !j.company || !j.title) continue;
      upsert.run({
        ...Object.fromEntries(MY_JOB_FIELDS.map((f) => [f, j[f] ?? null])),
        id: j.id,
        company: j.company,
        title: j.title,
        tags: JSON.stringify(j.tags ?? []),
        fit_reasons: JSON.stringify(j.fit_reasons ?? []),
        status: j.status ?? "shortlist",
        starred: j.starred ? 1 : 0,
        created_at: j.created_at ?? now(),
        updated_at: j.updated_at ?? now(),
      });
      saved++;
    }
  })();
  return { saved };
}

export function deleteMyJobs(ids: string[]) {
  const del = db().prepare(`DELETE FROM my_jobs WHERE id = ?`);
  let deleted = 0;
  for (const id of ids) deleted += del.run(id).changes;
  return { deleted };
}
