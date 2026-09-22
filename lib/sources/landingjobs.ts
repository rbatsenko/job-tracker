import { inferScope } from "../score";
import type { IncomingJob, Scope } from "../types";
import { getJSON, isRelevant, stripHtml } from "./util";

type Row = {
  id: number;
  title: string;
  company_name?: string;
  url: string;
  remote?: boolean;
  currency_code?: string;
  gross_salary_low?: number | null;
  gross_salary_high?: number | null;
  tags?: string[];
  role_description?: string;
  main_requirements?: string;
  published_at?: string;
  locations?: { city?: string; country?: string }[];
  type?: string;
};

/** European tech board (Portugal-founded), salary ranges usually published. */
export async function fetchLandingJobs(): Promise<IncomingJob[]> {
  const rows = await getJSON<Row[]>("https://landing.jobs/api/v1/jobs?limit=100");
  return (rows ?? [])
    .map<IncomingJob>((r) => {
      const places = (r.locations ?? [])
        .map((l) => [l.city, l.country].filter(Boolean).join(", "))
        .filter(Boolean);
      const scope: Scope = r.remote ? "eu" : inferScope(places.join(" / "));
      return {
        source: "landingjobs",
        external_id: String(r.id),
        url: r.url,
        company: r.company_name ?? r.url.split("/at/")[1]?.split("/")[0] ?? "Unknown",
        title: r.title,
        location: r.remote ? `Remote (Europe)` : (places[0] ?? "Europe"),
        remote_scope: scope,
        tags: r.tags ?? [],
        description: stripHtml(`${r.role_description ?? ""} ${r.main_requirements ?? ""}`),
        posted_at: r.published_at ?? null,
        employment: r.type ?? null,
        salary_min: r.gross_salary_low ?? null,
        salary_max: r.gross_salary_high ?? null,
        currency: r.currency_code ?? null,
        salary_period: r.gross_salary_high ? "year" : null,
      };
    })
    .filter(isRelevant);
}
