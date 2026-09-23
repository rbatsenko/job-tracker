/** Rough rates, enough to compare a salary with a floor. Not for anything financial. */
const TO_EUR: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17, PLN: 0.23 };

const PER_YEAR: Record<string, number> = { month: 12, hour: 1800 };

/** A salary figure as euros per year, whatever period and currency it was quoted in. */
export function yearlyEur(amount: number, period: string | null | undefined, currency: string | null | undefined) {
  return amount * (PER_YEAR[period ?? ""] ?? 1) * (TO_EUR[currency ?? "USD"] ?? 1);
}

export const eurRate = (currency: string) => TO_EUR[currency] ?? 1;
