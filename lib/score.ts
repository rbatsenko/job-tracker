import { PROFILE } from "./profile";
import type { IncomingJob, Scope } from "./types";

/** Talent marketplaces that repost the same listings across every board. */
const AGENCIES = [
  "lemon.io",
  "proxify",
  "toptal",
  "turing",
  "andela",
  "crossover",
  "x-team",
  "gun.io",
  "arc.dev",
  "upstaff",
  "deel",
  "remotemore",
  "strider",
];

const has = (haystack: string, needles: readonly string[]) =>
  needles.filter((n) => haystack.includes(n));

/**
 * Scores a job 0-100 from Kraków. Geography dominates on purpose: a perfect
 * role that can only be done from California is worth less than a good one
 * that is actually open to him.
 */
export function scoreJob(job: IncomingJob): { score: number; reasons: string[] } {
  const title = job.title.toLowerCase();
  const blob = [
    job.title,
    job.description ?? "",
    (job.tags ?? []).join(" "),
    job.location ?? "",
  ]
    .join(" ")
    .toLowerCase();

  let score = 28;
  const reasons: string[] = [];

  // --- geography -----------------------------------------------------------
  const scope: Scope = job.remote_scope ?? "unknown";
  const geo: Record<Scope, number> = {
    worldwide: 22,
    eu: 20,
    pl: 18,
    unknown: 0,
    other: -12,
    us: -35,
  };
  score += geo[scope];
  if (scope === "us") reasons.push("US-only remote — likely a dead end");
  else if (scope === "worldwide") reasons.push("Remote worldwide");
  else if (scope === "eu") reasons.push("Remote within Europe");
  else if (scope === "pl") reasons.push("Poland-based / Polish remote");

  // --- stack ---------------------------------------------------------------
  const core = has(blob, PROFILE.coreStack);
  const secondary = has(blob, PROFILE.secondaryStack);
  const bonus = has(blob, PROFILE.bonusTopics);

  const MAX_STACK = 34;
  const stack =
    Math.min(core.length * 5, 20) +
    Math.min(secondary.length * 2, 6) +
    Math.min(bonus.length * 3, 8);

  // Some boards give a full job description, others give a one-line tagline.
  // Scoring the thin ones on keyword count alone would rank them below verbose
  // listings for being thin, so blend what is known with a neutral prior.
  const hasBody = (job.description ?? "").length > 200;
  if (hasBody) {
    score += stack;
  } else {
    score += Math.round(stack * 0.5 + MAX_STACK * 0.5 * 0.5);
    reasons.push("Short listing — scored mostly on title and tags");
  }

  if (core.length) reasons.push(`Core stack: ${core.slice(0, 4).join(", ")}`);
  if (bonus.length) reasons.push(`Topics: ${bonus.slice(0, 3).join(", ")}`);

  // --- title ---------------------------------------------------------------
  const good = has(title, PROFILE.goodTitles);
  const bad = has(title, PROFILE.badTitles);
  score += Math.min(good.length * 3, 8);
  score -= bad.length * 25;
  if (bad.length) reasons.push(`Off-profile title: ${bad.join(", ")}`);
  if (/\b(senior|staff|lead|principal)\b/.test(title)) reasons.push("Senior-level title");

  // --- pay -----------------------------------------------------------------
  if (job.salary_max) {
    const yearly =
      job.salary_period === "month"
        ? job.salary_max * 12
        : job.salary_period === "hour"
          ? job.salary_max * 1800
          : job.salary_max;
    const eur = job.currency === "PLN" ? yearly / 4.3 : yearly;
    if (eur >= 90_000) {
      score += 6;
      reasons.push("Top of band is strong");
    } else if (eur > 0 && eur < 45_000) {
      score -= 8;
      reasons.push("Band looks low for senior");
    }
  }

  // Talent marketplaces and body shops: real work, but you are placed with a
  // client rather than joining a product team. Pushed down, not hidden.
  if (AGENCIES.some((a) => job.company.toLowerCase().includes(a))) {
    score -= 14;
    reasons.push("Staffing marketplace, not a direct employer");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/**
 * Best-effort reading of a free-text location / remote blurb.
 * Order matters: the most specific signal wins.
 */
/**
 * EU/EEA ISO codes. Matched case-sensitively against the original string and
 * only on short ones, because lowercasing would turn IT, NO, IS, BE and AT
 * into ordinary English words.
 */
const EU_CODES =
  /\b(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|NO|IS|LI|CH|UK|GB)\b/;

export function inferScope(text: string | null | undefined): Scope {
  if (!text) return "unknown";
  const t = text.toLowerCase();
  // Only trust bare country codes in short strings: "Remote (DE; GB; SE)",
  // "Warsaw, PL", not in the middle of a job description.
  const codes = text.length <= 70 ? EU_CODES.test(text) : false;

  if (/\b(poland|polska|warsaw|warszawa|krak|wroc|gdan|poznan|katowice)/.test(t)) return "pl";
  if (text.length <= 70 && /\bPL\b/.test(text)) return "pl";
  if (/\b(worldwide|anywhere|global|any location|fully remote)\b/.test(t)) return "worldwide";
  if (/\b(emea|europe|european|eu only|eu-based|\beu\b|cet|cest)\b/.test(t) || codes) return "eu";
  if (
    /(remote \(us\)|us only|usa only|united states only|us-based|must be located in the us|americas time zone|\bus\b\s*only)/.test(
      t,
    )
  )
    return "us";
  if (/\b(remote)\b/.test(t)) return "worldwide";
  return "unknown";
}
