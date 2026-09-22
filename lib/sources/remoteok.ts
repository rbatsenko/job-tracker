import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { getJSON, isRelevant, parseSalaryText, stripHtml } from "./util";

type Row = {
  id?: string;
  slug?: string;
  url?: string;
  company?: string;
  position?: string;
  location?: string;
  tags?: string[];
  description?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
  legal?: string;
};

export async function fetchRemoteOK(): Promise<IncomingJob[]> {
  const rows = await getJSON<Row[]>("https://remoteok.com/api");
  return rows
    .filter((r) => r.id && r.position && r.company)
    .map<IncomingJob>((r) => ({
      source: "remoteok",
      external_id: String(r.id),
      url: r.url ?? `https://remoteok.com/remote-jobs/${r.slug ?? r.id}`,
      company: r.company!,
      title: r.position!,
      location: r.location || null,
      remote_scope: inferScope(`${r.location ?? ""} ${(r.tags ?? []).join(" ")}`),
      tags: r.tags ?? [],
      description: stripHtml(r.description),
      posted_at: r.date ?? null,
      salary_min: r.salary_min || null,
      salary_max: r.salary_max || null,
      currency: r.salary_max ? "USD" : null,
      salary_period: r.salary_max ? "year" : null,
      employment: "full-time",
    }))
    .filter(isRelevant);
}
