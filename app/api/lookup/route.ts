import { inferScope } from "@/lib/score";
import { stripHtml } from "@/lib/sources/util";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Turns a pasted job link into form fields: Greenhouse, Lever and Ashby through their
 * public posting APIs, Traffit from its markup, anything else via schema.org JobPosting,
 * an embedded link to one of those ATSs, or the page title as a last resort.
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

/** "acme-corp" as it appears in an ATS link, shown as "Acme Corp". */
const slugToName = (slug: string) =>
  decodeURIComponent(slug)
    .split(/[-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** The caller chooses the URL, so refuse anything on a local or private network. */
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
    company: slugToName(m[1]),
    title: j.text?.trim(),
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
    company: slugToName(m[1]),
    title: job.title?.trim(),
    location: job.location ?? null,
    url: job.jobUrl ?? u.toString(),
    description: stripHtml(job.descriptionHtml ?? job.descriptionPlain, 1500),
    posted_at: job.publishedAt ?? null,
    via: "Ashby",
  };
}

const pick = (html: string, re: RegExp) => html.match(re)?.[1]?.trim() || null;
const pageTitle = (html: string) =>
  pick(html, /property=["']og:title["'][^>]*content=["']([^"']+)/i) ??
  pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, "").trim() ??
  pick(html, /<title>([^<]+)<\/title>/i);

/** Traffit has no API or JSON-LD, but renders og:title, and the subdomain is the employer. */
async function traffit(u: URL): Promise<Found | null> {
  const res = await get(u.toString(), false);
  if (!res.ok) return null;
  const html = await res.text();

  const title = pageTitle(html);
  if (!title) return null;

  const remote = /remote_status\.remote/.test(html);
  const published = html.match(/published_on[^0-9]*(\d{2})\/(\d{2})\/(\d{4})/);

  return {
    company: slugToName(u.hostname.split(".")[0]),
    title,
    location: remote ? "Remote" : null,
    url: u.toString(),
    description: stripHtml(html, 1500),
    posted_at: published ? `${published[3]}-${published[2]}-${published[1]}` : null,
    via: "Traffit",
  };
}

const ATS = [
  { host: "greenhouse.io", fetch: greenhouse, link: /https?:\/\/(?:job-boards|boards)\.greenhouse\.io\/[^/"'\s]+\/jobs\/\d+/ },
  { host: "lever.co", fetch: lever, link: /https?:\/\/jobs\.lever\.co\/[^/"'\s]+\/[0-9a-f-]{36}/ },
  { host: "ashbyhq.com", fetch: ashby, link: /https?:\/\/jobs\.ashbyhq\.com\/[^/"'\s]+\/[0-9a-f-]{36}/ },
  { host: "traffit.com", fetch: traffit },
];

/** A company careers page usually links to the ATS posting behind it. */
async function fromEmbeddedAts(html: string): Promise<Found | null> {
  for (const ats of ATS) {
    const link = ats.link && html.match(ats.link)?.[0];
    const u = link && safe(link.replace(/\\$/, ""));
    if (u) return ats.fetch(u);
  }
  return null;
}

/** "Software engineer | Bending Spoons" from the page title, when nothing better exists. */
function fromTitle(html: string, u: URL): Found | null {
  // <title> first: og:title is often the generic "Jobs at Acme".
  const raw = pick(html, /<title>([^<]+)<\/title>/i) ?? pageTitle(html);
  if (!raw) return null;
  const parts = raw.split(/\s+[|·–—-]\s+|\s+at\s+/);
  if (parts.length < 2) return null;
  const site = pick(html, /property=["']og:site_name["'][^>]*content=["']([^"']+)/i);
  return {
    title: parts[0].trim(),
    company: (site ?? parts[parts.length - 1]).replace(/\s*(careers|jobs)\s*$/i, "").trim(),
    location: null,
    url: u.toString(),
    description: pick(html, /name=["']description["'][^>]*content=["']([^"']+)/i),
    via: "the page title",
  };
}

export async function POST(request: Request) {
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  const u = url ? safe(url) : null;
  if (!u) return Response.json({ error: "That does not look like a job link." }, { status: 400 });

  const host = u.hostname.toLowerCase();
  try {
    let found = await ATS.find((a) => host.endsWith(a.host))?.fetch(u);

    if (!found) {
      const res = await get(u.toString(), false);
      const html = res.ok ? await res.text() : "";
      found = fromJsonLd(html, u.toString()) ?? (await fromEmbeddedAts(html)) ?? fromTitle(html, u);
    }

    if (!found?.title) {
      return Response.json(
        { error: "Could not read that page. Fill the fields in by hand.", url: u.toString() },
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
