// Generated from lib/score.ts — keep inferScope() in sync when you change it.
const EU_CODES =
  /\b(AT|BE|BG|HR|CY|CZ|DK|EE|FI|FR|DE|GR|HU|IE|IT|LV|LT|LU|MT|NL|PL|PT|RO|SK|SI|ES|SE|NO|IS|LI|CH|UK|GB)\b/;

export function inferScope(text) {
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
