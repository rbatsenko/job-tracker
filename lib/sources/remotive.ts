import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { getJSON, parseSalaryText, stripHtml } from "./util";

type Row = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

export async function fetchRemotive(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  // The public API returns the same handful of recent listings whatever category is asked for.
  const data = await getJSON<{ jobs: Row[] }>("https://remotive.com/api/remote-jobs?limit=200");
  for (const r of data.jobs ?? []) {
    out.push({
      source: "remotive",
      external_id: String(r.id),
      url: r.url,
      company: r.company_name,
      title: r.title,
      location: r.candidate_required_location || null,
      remote_scope: inferScope(r.candidate_required_location),
      tags: r.tags ?? [],
      description: stripHtml(r.description),
      posted_at: r.publication_date ?? null,
      employment: r.job_type ?? null,
      ...parseSalaryText(r.salary),
    });
  }
  return out;
}
