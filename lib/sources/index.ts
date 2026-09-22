import { recordRun, upsertJobs } from "../db";
import type { IncomingJob } from "../types";
import { fetchArbeitnow } from "./arbeitnow";
import { fetchHimalayas } from "./himalayas";
import { fetchJobicy } from "./jobicy";
import { fetchJustJoin } from "./justjoin";
import { fetchLandingJobs } from "./landingjobs";
import { fetchNoFluffJobs } from "./nofluffjobs";
import { fetchRemoteOK } from "./remoteok";
import { fetchRemotive } from "./remotive";
import { fetchWeWorkRemotely } from "./weworkremotely";

/** Boards that answer a plain server-side request. */
export const SERVER_SOURCES: Record<string, () => Promise<IncomingJob[]>> = {
  remoteok: fetchRemoteOK,
  remotive: fetchRemotive,
  arbeitnow: fetchArbeitnow,
  himalayas: fetchHimalayas,
  weworkremotely: fetchWeWorkRemotely,
  nofluffjobs: fetchNoFluffJobs,
  justjoin: fetchJustJoin,
  jobicy: fetchJobicy,
  landingjobs: fetchLandingJobs,
};

export type RefreshResult = {
  source: string;
  found: number;
  inserted: number;
  updated: number;
  error?: string;
};

export async function refreshSources(only?: string[]): Promise<RefreshResult[]> {
  const names = Object.keys(SERVER_SOURCES).filter((n) => !only?.length || only.includes(n));

  // One slow or broken board must not take the others down with it.
  const settled = await Promise.allSettled(
    names.map(async (name) => {
      const jobs = await SERVER_SOURCES[name]();
      const { inserted, updated } = upsertJobs(jobs);
      recordRun(name, jobs.length, inserted);
      return { source: name, found: jobs.length, inserted, updated } satisfies RefreshResult;
    }),
  );

  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : (() => {
          const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
          recordRun(names[i], 0, 0, message);
          return { source: names[i], found: 0, inserted: 0, updated: 0, error: message };
        })(),
  );
}
