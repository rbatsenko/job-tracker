import { ALL_RELEVANCE, PROFILES } from "../profile";
import type { IncomingJob } from "../types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// Locally SQLite is the cache. On Vercel each instance is empty, so lean on the fetch cache instead.
const cachePolicy = (): RequestInit =>
  process.env.VERCEL ? { next: { revalidate: 1800 } } : { cache: "no-store" };

async function request(url: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...cachePolicy(),
    ...init,
    headers: { "User-Agent": UA, ...init.headers },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

export const getJSON = async <T>(url: string, init?: RequestInit): Promise<T> =>
  (await request(url, { ...init, headers: { Accept: "application/json", ...init?.headers } })).json();

export const getText = async (url: string) => (await request(url)).text();

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…",
};

const unescape = (s: string) =>
  s.replace(/&[a-z]+;|&#\d+;/gi, (m) =>
    ENTITIES[m.toLowerCase()] ?? (/^&#\d+;$/.test(m) ? String.fromCharCode(Number(m.slice(2, -1))) : m),
  );

export const decodeEntities = (s: string | null | undefined) =>
  s ? unescape(s).replace(/\s+/g, " ").trim() : "";

export function stripHtml(html: string | null | undefined, max = 4000): string | null {
  if (!html) return null;
  return unescape(
    html
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|h\d|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const RELEVANT = [...ALL_RELEVANCE, ...Object.values(PROFILES).flatMap((p) => p.coreStack)];
const EXCLUDED = ["junior", "intern", "graduate", "apprentice", "recruiter", "account executive", "sales development"];

/** Keeps the catalogue to roles some profile could want. Taste is applied later, per viewer. */
export function isRelevant(job: IncomingJob): boolean {
  const title = job.title.toLowerCase();
  if (EXCLUDED.some((w) => title.includes(w))) return false;
  const text = [job.title, (job.tags ?? []).join(" "), job.description].join(" ").toLowerCase();
  return RELEVANT.some((k) => text.includes(k));
}

/** "$90k - $105k" and similar, best effort. */
export function parseSalaryText(s: string | null | undefined) {
  if (!s) return {};
  const currency = /€/.test(s) ? "EUR" : /£/.test(s) ? "GBP" : /\bPLN\b|zł/i.test(s) ? "PLN" : "USD";
  const amounts = [...s.matchAll(/(\d[\d.,]*)\s*([kK])?/g)]
    .map((m) => {
      const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
      return m[2] ? n * 1000 : n;
    })
    .filter((n) => Number.isFinite(n) && n > 500);
  if (!amounts.length) return {};
  return {
    salary_min: amounts[0],
    salary_max: amounts[amounts.length - 1],
    currency,
    salary_period: "year",
  };
}
