import { yearlyEur } from "./money";
import type { Scope, Status } from "./types";

/**
 * My jobs lives in the browser, so one deployment serves many people without accounts.
 * Entries are snapshots, never references into the catalogue. On Vercel the catalogue
 * is rebuilt per instance and its ids aren't stable.
 */

const KEY = "job-tracker:my-jobs:v1";

export type MyJob = {
  id: string;
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
  fit_score: number | null;
  fit_reasons: string[];
  status: Status;
  starred: boolean;
  notes: string | null;
  draft: string | null;
  applied_at: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

/** `removed` remembers deletions, so a copy on another device doesn't bring a job back. */
type MyJobsFile = { version: 1; exported_at: string; jobs: MyJob[]; removed?: Record<string, string> };

const now = () => new Date().toISOString();
// randomUUID only exists in secure contexts; plain http on a LAN address has none.
const newId = () =>
  `mj_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`}`;
const originKey = (o: { source: string; external_id: string }) => `${o.source}:${o.external_id}`;

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

const TOMBSTONE_DAYS = 90;

function readDoc(): { jobs: MyJob[]; removed: Record<string, string> } {
  if (typeof window === "undefined") return { jobs: [], removed: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as MyJobsFile | MyJob[];
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs;
    return {
      jobs: (jobs ?? []).filter((j) => typeof j?.id === "string"),
      removed: Array.isArray(parsed) ? {} : (parsed.removed ?? {}),
    };
  } catch {
    return { jobs: [], removed: {} };
  }
}

const read = () => readDoc().jobs;

function write(jobs: MyJob[], removed: Record<string, string> = readDoc().removed) {
  const cutoff = Date.now() - TOMBSTONE_DAYS * 86_400_000;
  const kept = Object.fromEntries(Object.entries(removed).filter(([, at]) => Date.parse(at) > cutoff));
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, exported_at: now(), jobs, removed: kept }));
  } catch (err) {
    throw new Error(
      `Couldn't save to this browser's storage${err instanceof Error ? ` (${err.message})` : ""}. Export your jobs before changing anything else.`,
    );
  }
}

// ---------------------------------------------------------------- sorting

export const SORTS = ["progress", "attention", "updated", "company", "salary"] as const;
export type SortKey = (typeof SORTS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  progress: "Furthest along",
  attention: "Needs a nudge",
  updated: "Recently updated",
  company: "Company",
  salary: "Salary",
};

const STAGE_RANK: Record<Status, number> = {
  offer: 0,
  interviewing: 1,
  replied: 2,
  applied: 3,
  drafted: 4,
  shortlist: 5,
  new: 6,
  rejected: 7,
  archived: 8,
};

const WAITING: Status[] = ["applied", "replied", "interviewing"];

const daysSince = (iso: string | null) => (iso ? (Date.now() - Date.parse(iso)) / 86_400_000 : -1);
const salary = (j: MyJob) => (j.salary_max ? yearlyEur(j.salary_max, j.salary_period, j.currency ?? "EUR") : -1);

export function sortMyJobs(jobs: MyJob[], key: SortKey = "progress"): MyJob[] {
  const list = [...jobs];
  switch (key) {
    case "attention":
      // Applications waiting on someone else, quiet longest first.
      return list.sort((a, b) => {
        const wa = WAITING.includes(a.status);
        const wb = WAITING.includes(b.status);
        if (wa !== wb) return wa ? -1 : 1;
        const quiet = (j: MyJob) => Math.max(daysSince(j.applied_at), daysSince(j.updated_at));
        return quiet(b) - quiet(a);
      });
    case "updated":
      return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    case "company":
      return list.sort((a, b) => a.company.localeCompare(b.company));
    case "salary":
      return list.sort((a, b) => salary(b) - salary(a));
    default:
      return list.sort(
        (a, b) =>
          STAGE_RANK[a.status] - STAGE_RANK[b.status] ||
          Number(b.starred) - Number(a.starred) ||
          b.updated_at.localeCompare(a.updated_at),
      );
  }
}

// ---------------------------------------------------------------- edits

export const listMyJobs = () => read();

export const trackedOrigins = () =>
  new Set(read().flatMap((j) => (j.origin ? [originKey(j.origin)] : [])));

export function addMyJob(input: Partial<MyJob> & { company: string; title: string }): MyJob {
  const job: MyJob = {
    ...BLANK,
    ...input,
    id: input.id ?? newId(),
    company: input.company.trim(),
    title: input.title.trim(),
    created_at: input.created_at ?? now(),
    updated_at: now(),
  };
  write([job, ...read()]);
  return job;
}

type BoardListing = Partial<MyJob> & { source: string; external_id: string; url: string; company: string; title: string };

/** Copies a board listing in full, so it outlives the catalogue. */
export function addFromBoard({ source, external_id, url, ...rest }: BoardListing): MyJob {
  const existing = read().find((j) => j.origin && originKey(j.origin) === originKey({ source, external_id }));
  return existing ?? addMyJob({ ...rest, url, origin: { source, external_id, url } });
}

export function updateMyJob(id: string, patch: Partial<MyJob>) {
  const jobs = read();
  const i = jobs.findIndex((j) => j.id === id);
  if (i === -1) return;
  const before = jobs[i];
  const stampApplied = patch.status === "applied" && !before.applied_at && !("applied_at" in patch);
  jobs[i] = { ...before, ...patch, id, updated_at: now(), ...(stampApplied && { applied_at: now() }) };
  write(jobs);
}

export function removeMyJob(id: string) {
  const { jobs, removed } = readDoc();
  write(jobs.filter((j) => j.id !== id), { ...removed, [id]: now() });
}

// ---------------------------------------------------------------- import / export

export const exportMyJobs = () =>
  JSON.stringify({ version: 1, exported_at: now(), jobs: read() } satisfies MyJobsFile, null, 2);

/** The whole document, deletions included, for sync. */
export const exportDoc = () => JSON.stringify({ version: 1, exported_at: now(), ...readDoc() } satisfies MyJobsFile);

/** The export plus a short brief, so pasting it into an assistant needs no explanation. */
export function copyForAssistant() {
  const count = read().length;
  return `Here is my job search, exported from my tracker (${count} ${count === 1 ? "job" : "jobs"}).

It lives in my browser, so you can't fetch or edit it directly. If you change anything,
give me back the whole JSON document in exactly this shape and I'll import it. Keep every "id".

Statuses: new, shortlist, drafted, applied, replied, interviewing, offer, rejected, archived.
"draft" is the message I plan to send.

${exportMyJobs()}`;
}

export type MergeResult = { added: number; updated: number; removed: number };

/**
 * Merges another copy of the list into this one. Jobs match on origin, then id.
 * A matched job takes only the fields the copy has (so a partial edit from an
 * assistant can't blank out notes), and only when the copy isn't older. Deletions
 * recorded in the copy are applied here unless the job was edited since.
 */
export function mergeDoc(doc: Partial<MyJobsFile> | MyJob[]): MergeResult {
  const incoming = Array.isArray(doc) ? doc : doc.jobs;
  if (!Array.isArray(incoming)) throw new Error("That file has no jobs in it.");
  const theirRemoved = Array.isArray(doc) ? {} : (doc.removed ?? {});

  const { jobs, removed } = readDoc();
  const byOrigin = new Map(jobs.flatMap((j) => (j.origin ? [[originKey(j.origin), j] as const] : [])));
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const result: MergeResult = { added: 0, updated: 0, removed: 0 };

  for (const raw of incoming) {
    if (!raw?.company || !raw?.title) continue;
    const given = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)) as Partial<MyJob>;
    const match = (raw.origin && byOrigin.get(originKey(raw.origin))) ?? (raw.id ? byId.get(raw.id) : undefined);
    if (match) {
      if (raw.updated_at && raw.updated_at < match.updated_at) continue;
      Object.assign(match, given, { id: match.id, created_at: match.created_at, updated_at: raw.updated_at ?? now() });
      result.updated++;
    } else {
      const deletedHere = raw.id && removed[raw.id];
      if (deletedHere && (!raw.updated_at || raw.updated_at < deletedHere)) continue;
      jobs.push({ ...BLANK, ...given, id: raw.id ?? newId(), created_at: raw.created_at ?? now(), updated_at: raw.updated_at ?? now() } as MyJob);
      result.added++;
    }
  }

  const merged = { ...removed };
  const keep = jobs.filter((j) => {
    const at = theirRemoved[j.id];
    if (at && j.updated_at < at) {
      result.removed++;
      return false;
    }
    return true;
  });
  for (const [id, at] of Object.entries(theirRemoved)) merged[id] = merged[id] && merged[id] > at ? merged[id] : at;

  write(keep, merged);
  return result;
}

/** A file from Export, or one an assistant handed back. Returns how many jobs were new. */
export const importMyJobs = (json: string) => mergeDoc(JSON.parse(json) as MyJobsFile | MyJob[]).added;
