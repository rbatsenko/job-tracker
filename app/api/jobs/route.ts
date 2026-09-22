import { facets, listJobs } from "@/lib/db";
import type { JobFilter } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const minScore = sp.get("minScore");

  const filter: JobFilter = {
    status: sp.get("status") ?? undefined,
    source: sp.get("source") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    q: sp.get("q") ?? undefined,
    minScore: minScore ? Number(minScore) : undefined,
    sort: (sp.get("sort") as JobFilter["sort"]) ?? undefined,
  };

  return Response.json({ jobs: listJobs(filter), facets: facets() });
}
