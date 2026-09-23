import { upsertJobs } from "../db";
import type { IncomingJob } from "../types";
import { fetchArbeitnow } from "./arbeitnow";
import { fetchHimalayas } from "./himalayas";
import { fetchJobicy } from "./jobicy";
import { fetchRemoteOK } from "./remoteok";
import { fetchRemotive } from "./remotive";
import { fetchWeWorkRemotely } from "./weworkremotely";

const SOURCES: Record<string, () => Promise<IncomingJob[]>> = {
  remoteok: fetchRemoteOK,
  remotive: fetchRemotive,
  himalayas: fetchHimalayas,
  jobicy: fetchJobicy,
  arbeitnow: fetchArbeitnow,
  weworkremotely: fetchWeWorkRemotely,
};

export type RefreshResult = { source: string; found: number; inserted: number; error?: string };

export async function refreshSources(only?: string[]): Promise<RefreshResult[]> {
  const names = Object.keys(SOURCES).filter((n) => !only?.length || only.includes(n));

  const settled = await Promise.allSettled(
    names.map(async (source) => {
      const jobs = await SOURCES[source]();
      const { inserted } = upsertJobs(jobs);
      return { source, found: jobs.length, inserted };
    }),
  );

  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const error = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return { source: names[i], found: 0, inserted: 0, error };
  });
}
