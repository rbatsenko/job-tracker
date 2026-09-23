import { facets, isPersistent, listJobs, type JobFilter } from "@/lib/db";
import { refreshSources } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

let filling: Promise<unknown> | null = null;

/** A cold in-memory instance starts empty; fill it once rather than showing nothing. */
async function ensureCatalogue() {
  if (isPersistent() || facets().total > 0) return;
  filling ??= refreshSources().finally(() => (filling = null));
  await filling;
}

function readFilter(sp: URLSearchParams): JobFilter {
  const num = (k: string) => (sp.has(k) ? Number(sp.get(k)) : undefined);
  return {
    q: sp.get("q") ?? undefined,
    source: sp.get("source") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    sort: (sp.get("sort") as JobFilter["sort"]) ?? undefined,
    profile: sp.get("profile") ?? undefined,
    minScore: num("minScore"),
    limit: num("limit"),
    full: sp.get("full") === "1",
  };
}

function respond(filter: JobFilter) {
  const jobs = listJobs(filter);
  return Response.json({
    jobs,
    facets: facets(),
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

/** Same as GET, with a custom profile in the body, since it's too big for a query string. */
export async function POST(request: Request) {
  await ensureCatalogue();
  const body = (await request.json().catch(() => ({}))) as { profile?: object };
  return respond({ ...readFilter(new URL(request.url).searchParams), profile: body.profile });
}
