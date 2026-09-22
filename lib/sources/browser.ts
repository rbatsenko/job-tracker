import { inferScope } from "../score";
import type { IncomingJob, Scope } from "../types";
import { stripHtml } from "./util";

/**
 * Normalisers for boards that block server-side requests (Cloudflare and
 * friends). Their pages are scraped in the browser and POSTed to /api/import,
 * so the parsing that matters still lives here and stays testable.
 */

export type RawBrowserJob = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? null : String(v));

/** Work at a Startup (YC) rows, as read off the directory listing. */
export function normaliseYC(rows: RawBrowserJob[]): IncomingJob[] {
  return rows.flatMap<IncomingJob>((r) => {
    const id = str(r.id);
    const title = str(r.title ?? r.t);
    const company = (str(r.company ?? r.c) ?? "").replace(/\s*\([A-Z]{0,2}\d{2}\)\s*$/, "").trim();
    if (!id || !title || !company) return [];

    const meta = str(r.meta ?? r.m) ?? "";

    // A YC meta line is a "·"-joined mix of badges, location, contract terms,
    // pay and experience. The location is simply the first segment that is none
    // of the others — taking segment 0 blindly picks up "Job match".
    const BADGE =
      /^(Job match|Interview Process|Fulltime|Full-time|Part-time|Contract|Intern|Will Sponsor|US Citizenship\/Visa (Not )?Required)$/i;
    const location =
      meta
        .split("·")
        .map((x) => x.trim())
        .find(
          (x) =>
            x &&
            !BADGE.test(x) &&
            !/^[$€£]/.test(x) &&
            !/%/.test(x) &&
            !/\b(Years|New Grads Ok)\b/i.test(x),
        ) ?? null;

    // "US Citizenship/Visa Not Required" is YC's own flag for hiring abroad.
    const visaFree = /not required/i.test(meta);
    const explicit = meta.match(/Remote \(([^)]*)\)/)?.[1] ?? null;
    // "Warsaw, PL / Remote" carries its reach in the location, not in brackets,
    // so read that before falling back to "remote means anywhere".
    const fromLocation = inferScope(location);

    let scope: Scope;
    if (explicit) scope = inferScope(explicit);
    else if (fromLocation === "pl" || fromLocation === "eu") scope = fromLocation;
    else if (/remote/i.test(meta)) scope = visaFree ? "worldwide" : "us";
    else scope = "other";
    if (!visaFree && scope !== "other") scope = "us";

    const salary = meta.match(/([$€£])([\d.]+)K\s*-\s*[$€£]?([\d.]+)K/);
    const currency = salary ? { $: "USD", "€": "EUR", "£": "GBP" }[salary[1]] : null;

    return [
      {
        source: "ycombinator",
        external_id: id,
        url: `https://www.workatastartup.com/jobs/${id}`,
        company,
        title,
        location,
        remote_scope: scope,
        tags: ["yc", str(r.batch) ?? ""].filter(Boolean) as string[],
        description: stripHtml(str(r.description)) ?? (str(r.tagline ?? r.tag) || null),
        salary_min: salary ? Number(salary[2]) * 1000 : null,
        salary_max: salary ? Number(salary[3]) * 1000 : null,
        currency,
        salary_period: salary ? "year" : null,
        employment: /fulltime|full-time/i.test(meta) ? "full-time" : null,
        posted_at: null,
      },
    ];
  });
}

const SENIORITY = ["Trainee", "Junior", "Mid", "Senior", "C-level", "Expert"];
const NOISE = new Set([
  "Show profile", "Super offer", "Locations", "Full-time", "Part-time",
  "(depends on contract)", "Undisclosed Salary", "New",
]);

/**
 * justjoin.it sits behind Cloudflare and its API refuses cross-origin calls,
 * so the offer cards are read from the rendered page. One card looks like:
 *
 *   Company | Show profile | Kraków | , +2 | Locations | Remote |
 *   Fullstack Engineer (TypeScript) | 8d left | 12 500 - 22 100 | PLN/month |
 *   TypeScript | React | Next.js | Mid | B2B, Permanent | Full-time
 *
 * The "8d left" / "New" badge always follows the title, which makes a reliable
 * pivot for splitting the rest.
 */
export function normaliseJustJoin(rows: RawBrowserJob[]): IncomingJob[] {
  return rows.flatMap<IncomingJob>((r) => {
    const href = str(r.href) ?? str(r.id) ?? "";
    const slug = href.split("/job-offer/").pop()?.split(/[?#]/)[0] ?? "";
    const card = str(r.card) ?? str(r.meta) ?? "";
    if (!slug || !card) return [];

    const segs = card.split("|").map((x) => x.trim()).filter(Boolean);
    const clean = segs.filter((x) => x !== "Super offer");

    const badgeAt = clean.findIndex((x) => /^(\d+[dh] left|New|Expires)/i.test(x));
    const title = str(r.title) || (badgeAt > 0 ? clean[badgeAt - 1] : "");
    if (!title) return [];

    const company = clean[0] ?? "Unknown";
    const remote = clean.some((x) => /^remote$/i.test(x));
    const city = clean
      .slice(1, badgeAt > 0 ? badgeAt - 1 : 4)
      .find((x) => !NOISE.has(x) && !/^,\s*\+\d+$/.test(x) && !/^remote$/i.test(x));

    const tail = badgeAt >= 0 ? clean.slice(badgeAt + 1) : clean;
    const payAt = tail.findIndex((x) => /^[\d\s]+-[\d\s]+$/.test(x));
    const pay = payAt >= 0 ? tail[payAt].split("-").map((n) => Number(n.replace(/\s/g, ""))) : null;
    const unit = payAt >= 0 ? (tail[payAt + 1] ?? "") : "";

    const seniority = tail.find((x) => SENIORITY.includes(x));
    const stopAt = seniority ? tail.indexOf(seniority) : tail.length;
    const tags = tail
      .slice(payAt >= 0 ? payAt + 2 : 0, stopAt)
      .filter((x) => !NOISE.has(x) && !/PLN|EUR|USD|\/month|\/hour/i.test(x));

    return [
      {
        source: "justjoin",
        external_id: slug,
        url: href.startsWith("http") ? href : `https://justjoin.it/job-offer/${slug}`,
        company,
        title,
        location: remote ? `Remote${city ? ` (${city})` : ""}` : (city ?? "Poland"),
        // A Polish board: "remote" there means remote from Poland.
        remote_scope: remote ? "pl" : "other",
        tags: [...tags, seniority].filter((x): x is string => Boolean(x)),
        salary_min: pay?.[0] ?? null,
        salary_max: pay?.[1] ?? null,
        currency: /PLN/i.test(unit) ? "PLN" : /EUR/i.test(unit) ? "EUR" : /USD/i.test(unit) ? "USD" : null,
        salary_period: !pay
          ? null
          : /hour|\/h\b/i.test(unit)
            ? "hour"
            : /year|\/yr|rok/i.test(unit)
              ? "year"
              : "month",
        employment: tail.find((x) => /B2B|Permanent|Contract/i.test(x)) ?? null,
        posted_at: null,
        description: null,
      },
    ];
  });
}

export const BROWSER_NORMALISERS = {
  ycombinator: normaliseYC,
  justjoin: normaliseJustJoin,
} as const;

export type BrowserSource = keyof typeof BROWSER_NORMALISERS;
