import { inferScope } from "@/lib/score";
import { stripHtml } from "@/lib/sources/util";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Turns a job link into filled-in fields.
 *
 * Most listings arrive as a URL — a friend's message, a careers page — and
 * retyping the company, title and location off a page is the most tedious part
 * of tracking anything. The big applicant systems all publish the posting as
 * JSON; for everything else, many pages carry a schema.org JobPosting.
 */

type Found = {
  company?: string;
  title?: string;
  location?: string | null;
  url: string;
  description?: string | null;
  posted_at?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
  via: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const get = (url: string, json = true) =>
  fetch(url, {
    headers: { "User-Agent": UA, Accept: json ? "application/json" : "text/html" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });

/** This endpoint fetches a URL the caller chose, so keep it off the local network. */
function safe(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    /^(127|10)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h.endsWith(".internal") ||
    h.endsWith(".local")
  )
    return null;
  return u;
}

/** schema.org JobPosting, which many career pages embed. */
function fromJsonLd(html: string, url: string): Found | null {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);

  for (const raw of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of list as Record<string, any>[]) {
      if (item?.["@type"] !== "JobPosting") continue;
      const loc = Array.isArray(item.jobLocation) ? item.jobLocation[0] : item.jobLocation;
      const addr = loc?.address ?? {};
      const place = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
        .filter((x) => typeof x === "string")
        .join(", ");
      const remote = item.jobLocationType === "TELECOMMUTE" ? "Remote" : "";
      const sal = item.baseSalary?.value ?? {};

      return {
        company: item.hiringOrganization?.name,
        title: item.title,
        location: [remote, place].filter(Boolean).join(" · ") || null,
        url,
        description: stripHtml(item.description, 1500),
        posted_at: item.datePosted ?? null,
        salary_min: Number(sal.minValue) || null,
        salary_max: Number(sal.maxValue) || Number(sal.value) || null,
        currency: item.baseSalary?.currency ?? null,
        salary_period:
          sal.unitText === "YEAR" ? "year" : sal.unitText === "MONTH" ? "month" : sal.unitText === "HOUR" ? "hour" : null,
        via: "the page's own JobPosting data",
      };
    }
  }
  return null;
}

async function greenhouse(u: URL): Promise<Found | null> {
  const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const res = await get(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?content=true`);
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, any>;
  const pay = (j.pay_input_ranges ?? [])[0];
  return {
    company: j.company_name ?? m[1],
    title: j.title,
    location: j.location?.name ?? null,
    url: j.absolute_url ?? u.toString(),
    description: stripHtml(j.content, 1500),
    posted_at: j.first_published ?? j.updated_at ?? null,
    salary_min: pay ? pay.min_cents / 100 : null,
    salary_max: pay ? pay.max_cents / 100 : null,
    currency: pay?.currency_type ?? null,
    salary_period: pay ? "year" : null,
    via: "Greenhouse",
  };
}

async function lever(u: URL): Promise<Found | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  const res = await get(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`);
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, any>;
  return {
    company: m[1],
    title: j.text,
    location: j.categories?.location ?? null,
    url: j.hostedUrl ?? u.toString(),
    description: stripHtml(j.descriptionPlain ?? j.description, 1500),
    posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    via: "Lever",
  };
}

async function ashby(u: URL): Promise<Found | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  const res = await get(`https://api.ashbyhq.com/posting-api/job-board/${m[1]}?includeCompensation=true`);
  if (!res.ok) return null;
  const board = (await res.json()) as { jobs?: Record<string, any>[] };
  const job = (board.jobs ?? []).find((j) => j.jobUrl?.includes(m[2]) || j.id === m[2]);
  if (!job) return null;
  return {
    company: m[1],
    title: job.title,
    location: job.location ?? null,
    url: job.jobUrl ?? u.toString(),
    description: stripHtml(job.descriptionHtml ?? job.descriptionPlain, 1500),
    posted_at: job.publishedAt ?? null,
    via: "Ashby",
  };
}

export async function POST(request: Request) {
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  const u = url ? safe(url) : null;
  if (!u) return Response.json({ error: "That does not look like a job link." }, { status: 400 });

  const host = u.hostname.toLowerCase();
  try {
    let found: Found | null = null;

    if (host.endsWith("greenhouse.io")) found = await greenhouse(u);
    else if (host.endsWith("lever.co")) found = await lever(u);
    else if (host.endsWith("ashbyhq.com")) found = await ashby(u);

    // Anything else, and anything the above could not place: read the page.
    if (!found) {
      const res = await get(u.toString(), false);
      if (res.ok) found = fromJsonLd(await res.text(), u.toString());
    }

    if (!found?.title) {
      return Response.json(
        {
          error:
            "Could not read that page. Fill the fields in by hand — the link is saved either way.",
          url: u.toString(),
        },
        { status: 422 },
      );
    }

    return Response.json({
      ...found,
      remote_scope: inferScope(`${found.location ?? ""} ${found.title ?? ""}`),
    });
  } catch {
    return Response.json(
      { error: "That page did not respond. Fill the fields in by hand.", url: u.toString() },
      { status: 502 },
    );
  }
}
