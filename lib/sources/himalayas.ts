import { inferScope } from "../score";
import type { IncomingJob, Scope } from "../types";
import { getJSON, isRelevant, stripHtml } from "./util";

type Row = {
  title: string;
  companyName: string;
  companySlug?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string | null;
  locationRestrictions?: string[];
  categories?: string[];
  description?: string;
  pubDate?: number;
  applicationLink?: string;
  guid?: string;
};

export async function fetchHimalayas(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  for (let offset = 0; offset < 200; offset += 100) {
    const data = await getJSON<{ jobs: Row[] }>(
      `https://himalayas.app/jobs/api?limit=100&offset=${offset}`,
    );
    if (!data.jobs?.length) break;
    for (const r of data.jobs) {
      const restrictions = r.locationRestrictions ?? [];
      // No restrictions listed on Himalayas means genuinely worldwide.
      const scope: Scope = restrictions.length
        ? inferScope(restrictions.join(", "))
        : "worldwide";
      out.push({
        source: "himalayas",
        external_id: r.guid ?? r.applicationLink ?? `${r.companySlug}-${r.title}`,
        url: r.applicationLink ?? r.guid ?? "https://himalayas.app/jobs",
        company: r.companyName,
        company_url: r.companySlug ? `https://himalayas.app/companies/${r.companySlug}` : null,
        title: r.title,
        location: restrictions.join(", ") || "Worldwide",
        remote_scope: scope,
        tags: r.categories ?? [],
        description: stripHtml(r.description),
        posted_at: r.pubDate ? new Date(r.pubDate * 1000).toISOString() : null,
        employment: r.employmentType ?? null,
        salary_min: r.minSalary ?? null,
        salary_max: r.maxSalary ?? null,
        currency: r.currency ?? (r.maxSalary ? "USD" : null),
        salary_period: r.salaryPeriod === "annual" ? "year" : (r.salaryPeriod ?? null),
      });
    }
  }
  return out.filter(isRelevant);
}
