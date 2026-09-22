"use client";

import type { Scope, Status } from "./types";

/**
 * My Jobs — the personal tracker.
 *
 * This is the product. It lives entirely in the viewer's browser, which is what
 * lets several people share one deployment with no accounts and no database.
 *
 * Every entry is a SELF-CONTAINED SNAPSHOT. It is never a pointer into the
 * scraped catalogue, because on a read-only host that catalogue is rebuilt from
 * scratch on each cold start and its row ids are not even stable between two
 * concurrent requests. A tracked job must survive the catalogue disappearing.
 */

const KEY = "job-tracker:my-jobs:v1";
const LEGACY_KEY = "job-tracker:state:v1";

export type MyJob = {
  /** Local and permanent. Never a catalogue row id. */
  id: string;
  /** Where it came from, when it came from the board. Provenance only. */
  origin: { source: string; external_id: string; url: string } | null;

  company: string;
  title: string;
  url: string | null;
  location: string | null;
  remote_scope: Scope | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  salary_period: string | null;
  tags: string[];
  description: string | null;

  /** Carried over from the board so the score survives the catalogue. */
  fit_score: number | null;
  fit_reasons: string[];

  status: Status;
  starred: boolean;
  notes: string | null;
  draft: string | null;
  applied_at: string | null;
  /** What you owe this application next, in your own words. */
  next_action: string | null;

  created_at: string;
  updated_at: string;
};

export type MyJobsFile = {
  version: 1;
  exported_at: string;
  jobs: MyJob[];
};

const now = () => new Date().toISOString();

const newId = () => {
  try {
    return `mj_${crypto.randomUUID()}`;
  } catch {
    return `mj_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
};

function read(): MyJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MyJobsFile | MyJob[];
    const jobs = Array.isArray(parsed) ? parsed : (parsed.jobs ?? []);
    return jobs.filter((j) => j && typeof j.id === "string");
  } catch {
    // Corrupt or blocked storage must not take the page down.
    return [];
  }
}

function write(jobs: MyJob[]): MyJob[] {
  try {
    const file: MyJobsFile = { version: 1, exported_at: now(), jobs };
    window.localStorage.setItem(KEY, JSON.stringify(file));
  } catch (err) {
    // Quota exceeded is the realistic failure. Surface it rather than
    // pretending the save worked.
    throw new Error(
      `Could not save to this browser's storage${
        err instanceof Error ? `: ${err.message}` : ""
      }. Export your jobs before making more changes.`,
    );
  }
  return jobs;
}

export const listMyJobs = (): MyJob[] =>
  read().sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) ||
      (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );

export const getMyJob = (id: string): MyJob | undefined =>
  read().find((j) => j.id === id);

/** Identity for "is this board listing already tracked". */
export const originKey = (source: string, external_id: string) =>
  `${source}:${external_id}`;

export function trackedOrigins(): Set<string> {
  return new Set(
    read()
      .filter((j) => j.origin)
      .map((j) => originKey(j.origin!.source, j.origin!.external_id)),
  );
}

const BLANK: Omit<MyJob, "id" | "company" | "title" | "created_at" | "updated_at"> = {
  origin: null,
  url: null,
  location: null,
  remote_scope: null,
  salary_min: null,
  salary_max: null,
  currency: null,
  salary_period: null,
  tags: [],
  description: null,
  fit_score: null,
  fit_reasons: [],
  status: "shortlist",
  starred: false,
  notes: null,
  draft: null,
  applied_at: null,
  next_action: null,
};

/** Add a job by hand. Only company and title are required. */
export function addMyJob(input: Partial<MyJob> & { company: string; title: string }): MyJob {
  const job: MyJob = {
    ...BLANK,
    ...input,
    id: input.id ?? newId(),
    company: input.company.trim(),
    title: input.title.trim(),
    tags: input.tags ?? [],
    fit_reasons: input.fit_reasons ?? [],
    created_at: input.created_at ?? now(),
    updated_at: now(),
  };
  write([job, ...read()]);
  return job;
}

/**
 * Copy a board listing into My Jobs. Takes a full snapshot so the entry stands
 * alone once the catalogue is gone.
 */
export function addFromBoard(row: {
  source: string;
  external_id: string;
  url: string;
  company: string;
  title: string;
  location?: string | null;
  remote_scope?: Scope | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
  tags?: string[];
  description?: string | null;
  fit_score?: number | null;
  fit_reasons?: string[];
}): MyJob {
  const existing = read().find(
    (j) =>
      j.origin &&
      j.origin.source === row.source &&
      j.origin.external_id === row.external_id,
  );
  if (existing) return existing;

  return addMyJob({
    company: row.company,
    title: row.title,
    url: row.url,
    origin: { source: row.source, external_id: row.external_id, url: row.url },
    location: row.location ?? null,
    remote_scope: row.remote_scope ?? null,
    salary_min: row.salary_min ?? null,
    salary_max: row.salary_max ?? null,
    currency: row.currency ?? null,
    salary_period: row.salary_period ?? null,
    tags: row.tags ?? [],
    description: row.description ?? null,
    fit_score: row.fit_score ?? null,
    fit_reasons: row.fit_reasons ?? [],
  });
}

/** Every field is editable, including the ones copied from the board. */
export function updateMyJob(id: string, patch: Partial<MyJob>): MyJob | null {
  const jobs = read();
  const i = jobs.findIndex((j) => j.id === id);
  if (i === -1) return null;

  const before = jobs[i];
  const next: MyJob = { ...before, ...patch, id: before.id, updated_at: now() };

  // Stamp the application date the first time it is marked applied, so you can
  // see how long it has been quiet.
  if (patch.status === "applied" && !before.applied_at && !patch.applied_at) {
    next.applied_at = now();
  }
  jobs[i] = next;
  write(jobs);
  return next;
}

export function removeMyJob(id: string): boolean {
  const jobs = read();
  const next = jobs.filter((j) => j.id !== id);
  if (next.length === jobs.length) return false;
  write(next);
  return true;
}

// ---------------------------------------------------------------- portability

/**
 * Browser storage is the only copy, so export is not a nice-to-have. It is also
 * the bridge to an agent: this is the exact shape to paste into Claude.
 */
export function exportMyJobs(): string {
  return JSON.stringify({ version: 1, exported_at: now(), jobs: read() } satisfies MyJobsFile, null, 2);
}

/**
 * The clipboard payload is the export plus a short brief, so pasting it into an
 * assistant is enough on its own — no separate explaining required.
 */
export function copyForAssistant(): string {
  const jobs = read();
  return `Here is my job search, exported from my tracker (${jobs.length} ${
    jobs.length === 1 ? "job" : "jobs"
  }).

It lives in my browser, so you cannot fetch or edit it directly. If you change
anything, give me back the whole JSON document in exactly this shape and I will
paste it into the Import button. Keep every "id" as it is.

Status values: new, shortlist, drafted, applied, replied, interviewing, offer,
rejected, archived. "draft" is the message I plan to send them.

${exportMyJobs()}`;
}

export type ImportMode = "merge" | "replace";

export function importMyJobs(json: string, mode: ImportMode = "merge"): number {
  const parsed = JSON.parse(json) as MyJobsFile | MyJob[];
  const incoming = (Array.isArray(parsed) ? parsed : parsed.jobs) ?? [];
  if (!Array.isArray(incoming)) throw new Error("That file has no jobs array.");

  const clean = incoming
    .filter((j) => j && j.company && j.title)
    .map<MyJob>((j) => ({
      ...BLANK,
      ...j,
      id: j.id ?? newId(),
      tags: j.tags ?? [],
      fit_reasons: j.fit_reasons ?? [],
      created_at: j.created_at ?? now(),
      updated_at: j.updated_at ?? now(),
    }));

  if (mode === "replace") {
    write(clean);
    return clean.length;
  }

  // Merge on origin where there is one, otherwise on id, otherwise append.
  const existing = read();
  const byOrigin = new Map(
    existing.filter((j) => j.origin).map((j) => [originKey(j.origin!.source, j.origin!.external_id), j]),
  );
  const byId = new Map(existing.map((j) => [j.id, j]));

  let added = 0;
  for (const job of clean) {
    const hit =
      (job.origin && byOrigin.get(originKey(job.origin.source, job.origin.external_id))) ??
      byId.get(job.id);
    if (hit) {
      Object.assign(hit, job, { id: hit.id, updated_at: now() });
    } else {
      existing.push(job);
      added++;
    }
  }
  write(existing);
  return added;
}

/**
 * The old store held annotations keyed by source:external_id, with no job data
 * of its own. Those keys are kept so the board can still show what was marked,
 * but they cannot become My Jobs entries without the catalogue rows — the app
 * resolves them opportunistically when the board is loaded.
 */
export function readLegacyAnnotations(): Record<string, { status?: Status; starred?: boolean; notes?: string; draft?: string; applied_at?: string | null }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LEGACY_KEY) ?? "{}");
  } catch {
    return {};
  }
}
