import { ALL_RELEVANCE, PROFILES } from "../profile";
import type { IncomingJob } from "../types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * Locally the database is the cache, so every fetch goes to the board. On a
 * read-only host the database is per-instance memory, so the platform's fetch
 * cache is what stops each cold start from re-crawling every board.
 */
const cachePolicy = (): RequestInit =>
  process.env.VERCEL ? { next: { revalidate: 1800 } } : { cache: "no-store" };

export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...cachePolicy(),
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    ...cachePolicy(),
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.text();
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…",
};

/** RSS and JSON feeds both hand back entity-escaped titles. */
export function decodeEntities(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? (
      /^&#\d+;$/.test(m) ? String.fromCharCode(Number(m.slice(2, -1))) : m
    ))
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(html: string | null | undefined, max = 4000): string | null {
  if (!html) return null;
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h\d|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? (
      /^&#\d+;$/.test(m) ? String.fromCharCode(Number(m.slice(2, -1))) : m
    ))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, max);
}

/**
 * The gate is the UNION across every profile. Filtering here by one person's
 * stack is what previously threw away every design role before it was stored.
 */
const RELEVANT = [
  ...ALL_RELEVANCE,
  ...Object.values(PROFILES).flatMap((p) => p.coreStack),
];

/**
 * Universal exclusions only. "marketing manager" and "social media" used to be
 * here and wrongly caught legitimate design roles, so they are gone — an
 * off-profile title is handled by scoring, not by refusing to store it.
 */
const DISQUALIFY = [
  "junior",
  "intern",
  "graduate",
  "apprentice",
  "recruiter",
  "account executive",
  "sales development",
];

/**
 * Cheap gate applied before anything is stored: keeps the database about work
 * someone here might actually want, rather than every remote job on the
 * internet — without deciding whose taste wins.
 */
export function isRelevant(job: IncomingJob): boolean {
  const title = job.title.toLowerCase();
  if (DISQUALIFY.some((d) => title.includes(d))) return false;

  const blob = [job.title, (job.tags ?? []).join(" "), job.description ?? ""]
    .join(" ")
    .toLowerCase();
  return RELEVANT.some((k) => blob.includes(k));
}

/** "$90k - $105k" and friends → numbers. Best effort; null when unclear. */
export function parseSalaryText(s: string | null | undefined) {
  if (!s) return {};
  const cur = /€/.test(s) ? "EUR" : /£/.test(s) ? "GBP" : /\bPLN\b|zł/i.test(s) ? "PLN" : "USD";
  const nums = [...s.matchAll(/(\d[\d.,]*)\s*([kK])?/g)]
    .map((m) => {
      const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
      return Number.isFinite(n) ? (m[2] ? n * 1000 : n) : null;
    })
    .filter((n): n is number => n !== null && n > 500);
  if (!nums.length) return {};
  return {
    salary_min: nums[0] ?? null,
    salary_max: nums.length > 1 ? nums[nums.length - 1] : (nums[0] ?? null),
    currency: cur,
    salary_period: "year",
  };
}
