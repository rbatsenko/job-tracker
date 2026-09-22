import { getProfile, resolveProfile, type Profile } from "./profile";
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
export function scoreJob(
  job: IncomingJob,
  profileOrKey?: string | null | object,
): { score: number; reasons: string[] } {
  const PROFILE: Profile =
    typeof profileOrKey === "object" && profileOrKey !== null
      ? resolveProfile(profileOrKey)
      : getProfile(profileOrKey as string | null | undefined);
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
  const { regions, canWorkUS, willRelocate } = PROFILE.reach;
  const wantsWorldwide = regions.includes("worldwide");

  if (scope === "us") {
    // A US-only role is either the best case or a dead end; nothing in between.
    score += canWorkUS ? 20 : -35;
    reasons.push(canWorkUS ? "US-based, which works for you" : "US-only — likely a dead end");
  } else if (scope === "worldwide") {
    score += 22;
    reasons.push("Remote worldwide");
  } else if (regions.includes(scope)) {
    score += 20;
    reasons.push(`Remote in ${scope.toUpperCase()}, where you can work`);
  } else if (scope === "other") {
    score += willRelocate ? 4 : -12;
    if (!willRelocate) reasons.push("On-site, outside where you work");
  } else if (scope === "unknown") {
    // Not stated is not the same as ruled out.
    score += wantsWorldwide ? 6 : 2;
  } else {
    score += wantsWorldwide ? 8 : -6;
    if (!wantsWorldwide) reasons.push(`Remote in ${scope.toUpperCase()}, outside your regions`);
  }

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
  // Seniority words say how senior, not what kind of job. Keep them out of the
  // test for "is this even the right family".
  const SENIORITY = ["senior", "staff", "lead", "principal", "head of"];
  const familyTitles = PROFILE.goodTitles.filter((t) => !SENIORITY.includes(t));
  const familyHit = has(title, familyTitles);

  const good = has(title, PROFILE.goodTitles);
  const bad = has(title, PROFILE.badTitles);
  score += Math.min(good.length * 3, 8);
  score -= bad.length * 25;
  if (bad.length) reasons.push(`Off-profile title: ${bad.join(", ")}`);

  // A description can be full of the right words while the job is something
  // else — a design studio hiring a Shopify developer reads as a design role
  // until you look at the title.
  if (!familyHit.length) {
    score -= 14;
    reasons.push("Title does not name this kind of role");
  }
  if (/\b(senior|staff|lead|principal)\b/.test(title)) reasons.push("Senior-level title");

  // --- pay -----------------------------------------------------------------
  const { floor, strong, currency } = PROFILE.money;
  if (job.salary_max && (floor > 0 || strong > 0)) {
    const yearly =
      job.salary_period === "month"
        ? job.salary_max * 12
        : job.salary_period === "hour"
          ? job.salary_max * 1800
          : job.salary_max;

    // Rough, but enough to compare a band against an expectation.
    const TO_EUR: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, PLN: 0.23 };
    const inEur = yearly * (TO_EUR[job.currency ?? "USD"] ?? 1);
    const strongEur = strong * (TO_EUR[currency] ?? 1);
    const floorEur = floor * (TO_EUR[currency] ?? 1);

    if (strongEur > 0 && inEur >= strongEur) {
      score += 6;
      reasons.push("Top of band is strong for you");
    } else if (floorEur > 0 && inEur > 0 && inEur < floorEur) {
      score -= 8;
      reasons.push("Below the salary you set");
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
