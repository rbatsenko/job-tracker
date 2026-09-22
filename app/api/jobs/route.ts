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

function readFilter(sp: URLSearchParams): JobFilter {
  const minScore = sp.get("minScore");
  return {
    status: sp.get("status") ?? undefined,
    source: sp.get("source") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    q: sp.get("q") ?? undefined,
    minScore: minScore ? Number(minScore) : undefined,
    sort: (sp.get("sort") as JobFilter["sort"]) ?? undefined,
    // A preset name. Leaving it out means the listing comes back unscored.
    profile: sp.get("profile") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    full: sp.get("full") === "1",
  };
}

function respond(filter: JobFilter) {
  const jobs = listJobs(filter);
  return Response.json({
    jobs,
    facets: facets(),
    // Say what was applied, so a caller knows it is seeing a page and whether
    // these numbers mean anything.
    query: {
      ...filter,
      profile: typeof filter.profile === "object" ? "custom" : (filter.profile ?? null),
      scored: Boolean(filter.profile),
      limit: filter.limit ?? 25,
      returned: jobs.length,
    },
  });
}

export async function GET(request: Request) {
  await ensureCatalogue();
  return respond(readFilter(new URL(request.url).searchParams));
}

/**
 * Same listing, but the viewer brings their own profile rather than picking a
 * preset. It goes in the body because a profile is too big for a query string.
 */
export async function POST(request: Request) {
  await ensureCatalogue();
  const sp = new URL(request.url).searchParams;
  const body = (await request.json().catch(() => ({}))) as {
    filter?: Partial<JobFilter>;
    profile?: object;
  };
  return respond({ ...readFilter(sp), ...body.filter, profile: body.profile });
}
