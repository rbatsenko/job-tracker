import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { getJSON, stripHtml } from "./util";

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

// The industry slugs the API answers to. Others return nothing or an error.
const INDUSTRIES = ["engineering", "design-multimedia", "data-science", "marketing", "business", "management", "supporting", "hr"];

export async function fetchJobicy(): Promise<IncomingJob[]> {
  const batches = await Promise.all(
    INDUSTRIES.map((industry) =>
      getJSON<{ jobs: Row[] }>(`https://jobicy.com/api/v2/remote-jobs?count=100&industry=${industry}`)
        .then((d) => d.jobs ?? [])
        .catch(() => []),
    ),
  );
  const unique = [...new Map(batches.flat().map((r) => [String(r.id), r])).values()];

  return unique
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
}
