import { facets, isPersistent, listJobs } from "@/lib/db";
import type { JobFilter } from "@/lib/db";
import { refreshSources } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * On a host without a writable filesystem every cold instance starts with an
 * empty in-memory catalogue, which would show a visitor nothing until they
 * thought to press Refresh. Fill it once, on demand.
 */
let filling: Promise<unknown> | null = null;

async function ensureCatalogue() {
  if (isPersistent() || facets().total > 0) return;
  filling ??= refreshSources().finally(() => {
    filling = null;
  });
  await filling;
}

export async function GET(request: Request) {
  await ensureCatalogue();

  const sp = new URL(request.url).searchParams;
  const minScore = sp.get("minScore");

  const filter: JobFilter = {
    status: sp.get("status") ?? undefined,
    source: sp.get("source") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    q: sp.get("q") ?? undefined,
    minScore: minScore ? Number(minScore) : undefined,
    sort: (sp.get("sort") as JobFilter["sort"]) ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    full: sp.get("full") === "1",
  };

  const jobs = listJobs(filter);
  return Response.json({
    jobs,
    facets: facets(),
    // Say what was applied, so a caller knows it is seeing a page not the lot.
    query: { ...filter, limit: filter.limit ?? 25, returned: jobs.length },
  });
}
