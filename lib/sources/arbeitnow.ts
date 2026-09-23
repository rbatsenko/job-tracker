import { inferScope } from "../score";
import type { IncomingJob } from "../types";
import { getJSON, stripHtml } from "./util";

type Row = {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

export async function fetchArbeitnow(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await getJSON<{ data: Row[] }>(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
    );
    if (!data.data?.length) break;
    for (const r of data.data) {
      if (!r.remote) continue;
      out.push({
        source: "arbeitnow",
        external_id: r.slug,
        url: r.url,
        company: r.company_name,
        title: r.title,
        location: r.location || "Europe",
        // A European board, so a remote listing without a location is remote in Europe.
        remote_scope: inferScope(`${r.location ?? ""} europe remote`),
        tags: [...(r.tags ?? []), ...(r.job_types ?? [])],
        description: stripHtml(r.description),
        posted_at: r.created_at ? new Date(r.created_at * 1000).toISOString() : null,
        employment: r.job_types?.[0] ?? null,
      });
    }
  }
  return out;
}
