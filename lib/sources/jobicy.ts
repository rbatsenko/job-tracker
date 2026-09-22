import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { getJSON, isRelevant, stripHtml } from "./util";

type Row = {
  id: string | number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Jobicy files design under "design-multimedia"; plain "design" returns nothing.
const INDUSTRIES = ["engineering", "design-multimedia"];

export async function fetchJobicy(): Promise<IncomingJob[]> {
  const batches = await Promise.all(
    INDUSTRIES.map((industry) =>
      getJSON<{ jobs: Row[] }>(
        `https://jobicy.com/api/v2/remote-jobs?count=100&industry=${industry}`,
      ).catch(() => ({ jobs: [] as Row[] })),
    ),
  );
  const seen = new Set<string>();
  const data = {
    jobs: batches.flatMap((b) => b.jobs ?? []).filter((r) => {
      const id = String(r.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  };
  return (data.jobs ?? [])
    .map<IncomingJob>((r) => ({
      source: "jobicy",
      external_id: String(r.id),
      url: r.url,
      company: r.companyName,
      title: r.jobTitle,
      location: r.jobGeo || "Anywhere",
      remote_scope: inferScope(r.jobGeo),
      tags: [...(r.jobIndustry ?? []), ...(r.jobType ?? []), r.jobLevel ?? ""].filter(Boolean),
      description: stripHtml(r.jobDescription ?? r.jobExcerpt),
      posted_at: r.pubDate ?? null,
      employment: r.jobType?.[0] ?? null,
      salary_min: num(r.salaryMin),
      salary_max: num(r.salaryMax),
      currency: r.salaryCurrency ?? null,
      salary_period: r.salaryPeriod === "hourly" ? "hour" : (r.salaryPeriod ?? null),
    }))
    .filter(isRelevant);
}
