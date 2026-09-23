import { EU_CODES, countryName, detectCountry } from "./countries";
import { fieldLabel, fieldOf } from "./fields";
import { eurRate, yearlyEur } from "./money";
import { getProfile, resolveProfile, type Profile } from "./profile";
import type { IncomingJob, Scope } from "./types";

const AGENCIES = [
  "lemon.io", "proxify", "toptal", "turing", "andela", "crossover", "x-team",
  "gun.io", "arc.dev", "upstaff", "deel", "remotemore", "strider",
];

const SENIORITY = ["senior", "staff", "lead", "principal", "head of"];
/** The most the stack match can add: 20 core + 6 secondary + 8 topics. */
const MAX_STACK = 34;

const matches = (haystack: string, needles: readonly string[]) =>
  needles.filter((n) => haystack.includes(n));

function geography(scope: string, { regions, canWorkUS, willRelocate }: Profile["reach"]) {
  const worldwide = regions.includes("worldwide");
  const europe = regions.includes("eu") || regions.some((r) => EU_CODES.has(r));

  if (scope === "worldwide") return { points: 22, reason: "Remote worldwide" };
  if (scope === "us")
    return canWorkUS
      ? { points: 20, reason: "United States, which works for you" }
      : { points: -35, reason: "US-only, likely a dead end" };
  if (scope === "eu") return { points: europe ? 20 : worldwide ? 4 : -8, reason: europe ? "Remote across Europe" : null };
  // Not stated isn't the same as ruled out.
  if (scope === "unknown") return { points: worldwide ? 6 : 2, reason: null };
  if (regions.includes(scope)) return { points: 20, reason: `In ${countryName(scope)}, where you can work` };
  if (europe && EU_CODES.has(scope)) return { points: 16, reason: `In ${countryName(scope)}, inside Europe` };
  if (worldwide) return { points: 4, reason: null };
  if (willRelocate) return { points: 2, reason: `In ${countryName(scope)}, if you'd move` };
  return { points: -10, reason: `In ${countryName(scope)}, outside where you can work` };
}

/** Scores a listing 0-100 for one viewer. Geography dominates: a great job you can't take is worth little. */
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
  // so a short one gets half of what it matched plus half of an average score.
  if ((job.description ?? "").length > 200) {
    score += stack;
  } else {
    score += Math.round((stack + MAX_STACK / 2) / 2);
    reasons.push("Short listing, scored mostly on title and tags");
  }
  if (core.length) reasons.push(`Core stack: ${core.slice(0, 4).join(", ")}`);
  if (bonus.length) reasons.push(`Topics: ${bonus.slice(0, 3).join(", ")}`);

  // The description can be full of the right words while the job is something else,
  // so the title decides which field a listing is in.
  if (p.field !== "other") {
    const field = fieldOf(job.title);
    if (field === "other") {
      score -= 14;
      reasons.push("Title does not say what kind of role this is");
    } else if (field !== p.field) {
      score -= 25;
      reasons.push(`${fieldLabel(field)} role, not ${p.label.toLowerCase()}`);
    }
  }
  const senior = matches(title, SENIORITY);
  score += Math.min(senior.length * 3, 8);
  if (senior.length) reasons.push("Senior-level title");

  const { floor, strong, currency } = p.money;
  if (job.salary_max && (floor || strong)) {
    const eur = yearlyEur(job.salary_max, job.salary_period, job.currency);
    const rate = eurRate(currency);
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
  if (/(remote \(us\)|us only|usa only|united states only|us-based|must be located in the us)/.test(t))
    return "us";
  if (/\b(emea|europe|european|eu only|eu-based|eu)\b/.test(t)) return "eu";

  const country = detectCountry(text);
  if (country) return country;
  return /\bremote\b/.test(t) ? "worldwide" : "unknown";
}
