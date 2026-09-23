import { EU_CODES, countryName, detectCountry } from "./countries";
import { getProfile, resolveProfile, type Profile } from "./profile";
import type { IncomingJob, Scope } from "./types";

const AGENCIES = [
  "lemon.io", "proxify", "toptal", "turing", "andela", "crossover", "x-team",
  "gun.io", "arc.dev", "upstaff", "deel", "remotemore", "strider",
];

const SENIORITY = ["senior", "staff", "lead", "principal", "head of"];
const TO_EUR: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, PLN: 0.23 };

const matches = (haystack: string, needles: readonly string[]) =>
  needles.filter((n) => haystack.includes(n));

function geography(scope: string, { regions, canWorkUS, willRelocate }: Profile["reach"]) {
  const worldwide = regions.includes("worldwide");
  const europe = regions.includes("eu") || regions.some((r) => EU_CODES.has(r));

  if (scope === "worldwide") return { points: 22, reason: "Remote worldwide" };
  if (scope === "us")
    return canWorkUS
      ? { points: 20, reason: "United States, which works for you" }
      : { points: -35, reason: "US-only — likely a dead end" };
  if (scope === "eu") return { points: europe ? 20 : worldwide ? 4 : -8, reason: europe ? "Remote across Europe" : null };
  if (scope === "other")
    return { points: willRelocate ? 4 : -12, reason: willRelocate ? null : "On-site, outside where you work" };
  // Not stated isn't the same as ruled out.
  if (scope === "unknown") return { points: worldwide ? 6 : 2, reason: null };
  if (regions.includes(scope)) return { points: 20, reason: `In ${countryName(scope)}, where you can work` };
  if (europe && EU_CODES.has(scope)) return { points: 16, reason: `In ${countryName(scope)}, inside Europe` };
  if (worldwide) return { points: 4, reason: null };
  return { points: -10, reason: `In ${countryName(scope)}, outside where you can work` };
}

/** Scores a listing 0–100 for one viewer. Geography dominates: a great job you can't take is worth little. */
export function scoreJob(job: IncomingJob, profile?: string | object | null) {
  const p = profile && typeof profile === "object" ? resolveProfile(profile) : getProfile(profile);
  const title = job.title.toLowerCase();
  const text = [job.title, job.description, (job.tags ?? []).join(" "), job.location].join(" ").toLowerCase();

  let score = 28;
  const reasons: string[] = [];

  const geo = geography(job.remote_scope ?? "unknown", p.reach);
  score += geo.points;
  if (geo.reason) reasons.push(geo.reason);

  const core = matches(text, p.coreStack);
  const secondary = matches(text, p.secondaryStack);
  const bonus = matches(text, p.bonusTopics);
  const stack =
    Math.min(core.length * 5, 20) + Math.min(secondary.length * 2, 6) + Math.min(bonus.length * 3, 8);

  // A one-line tagline shouldn't rank below a verbose listing just for being short,
  // so blend what little we know with a neutral prior.
  if ((job.description ?? "").length > 200) {
    score += stack;
  } else {
    score += Math.round(stack / 2 + 34 / 4);
    reasons.push("Short listing — scored mostly on title and tags");
  }
  if (core.length) reasons.push(`Core stack: ${core.slice(0, 4).join(", ")}`);
  if (bonus.length) reasons.push(`Topics: ${bonus.slice(0, 3).join(", ")}`);

  const good = matches(title, p.goodTitles);
  const bad = matches(title, p.badTitles);
  score += Math.min(good.length * 3, 8) - bad.length * 25;
  if (bad.length) reasons.push(`Off-profile title: ${bad.join(", ")}`);

  // The description can be full of the right words while the job is something else.
  if (!matches(title, p.goodTitles.filter((t) => !SENIORITY.includes(t))).length) {
    score -= 14;
    reasons.push("Title does not name this kind of role");
  }
  if (/\b(senior|staff|lead|principal)\b/.test(title)) reasons.push("Senior-level title");

  const { floor, strong, currency } = p.money;
  if (job.salary_max && (floor || strong)) {
    const perYear =
      job.salary_period === "month" ? job.salary_max * 12
      : job.salary_period === "hour" ? job.salary_max * 1800
      : job.salary_max;
    const eur = perYear * (TO_EUR[job.currency ?? "USD"] ?? 1);
    const rate = TO_EUR[currency] ?? 1;
    if (strong && eur >= strong * rate) {
      score += 6;
      reasons.push("Top of band is strong for you");
    } else if (floor && eur < floor * rate) {
      score -= 8;
      reasons.push("Below the salary you set");
    }
  }

  if (AGENCIES.some((a) => job.company.toLowerCase().includes(a))) {
    score -= 14;
    reasons.push("Staffing marketplace, not a direct employer");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

/** Reads a listing's reach from free text: "worldwide", "us", "eu", a country code, or "unknown". */
export function inferScope(text: string | null | undefined): Scope {
  if (!text) return "unknown";
  const t = text.toLowerCase();

  if (/\b(worldwide|anywhere|global|any location|fully remote)\b/.test(t)) return "worldwide";
  if (/(remote \(us\)|us only|usa only|united states only|us-based|must be located in the us|americas time zone)/.test(t))
    return "us";
  if (/\b(emea|europe|european|eu only|eu-based|eu)\b/.test(t)) return "eu";

  const country = detectCountry(text);
  if (country) return country;
  return /\bremote\b/.test(t) ? "worldwide" : "unknown";
}
