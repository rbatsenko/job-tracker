import type { IncomingJob, Scope } from "../types";
import { getJSON, isRelevant } from "./util";

type Posting = {
  id: string;
  name: string;
  title: string;
  technology?: string;
  category?: string;
  seniority?: string[];
  url: string;
  regions?: string[];
  fullyRemote?: boolean;
  location?: { places?: { city?: string; country?: { code?: string; name?: string } }[] };
  salary?: { from?: number; to?: number; currency?: string; period?: string; type?: string };
  posted?: number;
  tiles?: { values?: { value: string; type: string }[] };
};

const QUERIES = [
  "remote typescript",
  "remote react",
  "remote node",
  "remote senior frontend",
  "remote fullstack",
];

/** Poland's biggest IT board after justjoin.it, and it answers server-side. */
export async function fetchNoFluffJobs(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  const seen = new Set<string>();

  for (const rawSearch of QUERIES) {
    const data = await getJSON<{ postings: Posting[] }>(
      "https://nofluffjobs.com/api/search/posting?limit=60&salaryCurrency=PLN&salaryPeriod=month&region=pl",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawSearch }) },
    );

    for (const p of data.postings ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);

      const cities = (p.location?.places ?? []).map((x) => x.city).filter(Boolean);
      const isRemote = p.fullyRemote || cities.some((c) => /remote|zdalnie/i.test(c ?? ""));
      const scope: Scope = isRemote ? "pl" : "other";

      out.push({
        source: "nofluffjobs",
        external_id: p.id,
        url: `https://nofluffjobs.com/job/${p.url}`,
        company: p.name,
        title: p.title.trim(),
        location: isRemote ? "Remote (Poland)" : (cities.slice(0, 3).join(", ") || "Poland"),
        remote_scope: scope,
        tags: [
          p.technology,
          p.category,
          ...(p.seniority ?? []),
          ...(p.tiles?.values ?? []).filter((t) => t.type === "requirement").map((t) => t.value),
        ].filter((x): x is string => Boolean(x)),
        salary_min: p.salary?.from ?? null,
        salary_max: p.salary?.to ?? null,
        currency: p.salary?.currency ?? null,
        salary_period: p.salary?.period?.toLowerCase() ?? null,
        posted_at: p.posted ? new Date(p.posted).toISOString() : null,
        employment: p.salary?.type ?? null,
        description: null,
      });
    }
  }
  return out.filter(isRelevant);
}
