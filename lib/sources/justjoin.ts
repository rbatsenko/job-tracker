import type { IncomingJob, Scope } from "../types";
import { getJSON, isRelevant } from "./util";

type Offer = {
  guid: string;
  slug: string;
  title: string;
  workplaceType?: string;
  workingTime?: string;
  experienceLevel?: string;
  city?: string;
  companyName: string;
  publishedAt?: string;
  employmentTypes?: {
    from?: number | null;
    to?: number | null;
    currency?: string;
    unit?: string;
    type?: string;
  }[];
  requiredSkills?: { name?: string }[];
  locations?: { city?: string }[];
};

/**
 * Poland's largest tech board. api.justjoin.it refuses server-side callers,
 * but the site's own same-origin candidate API answers plain requests.
 */
export async function fetchJustJoin(): Promise<IncomingJob[]> {
  const out: IncomingJob[] = [];
  const seen = new Set<string>();
  // The endpoint pages on from/itemsCount, not page/perPage — anything else is
  // silently ignored and you get the same first ten rows forever.
  const PER = 100;

  for (let from = 0; from < 800; from += PER) {
    const data = await getJSON<{ data: Offer[] }>(
      `https://justjoin.it/api/candidate-api/offers?from=${from}&itemsCount=${PER}&sortBy=newest`,
    );
    if (!data.data?.length) break;

    for (const o of data.data) {
      if (!o.slug || seen.has(o.slug)) continue;
      seen.add(o.slug);

      const remote = o.workplaceType === "remote";
      // The board is Polish, so remote there means remote from Poland.
      const scope: Scope = remote ? "pl" : "other";

      const paid = (o.employmentTypes ?? []).find((e) => e.to || e.from);
      const cities = [o.city, ...(o.locations ?? []).map((l) => l.city)].filter(Boolean);

      out.push({
        source: "justjoin",
        external_id: o.slug,
        url: `https://justjoin.it/job-offer/${o.slug}`,
        company: o.companyName,
        title: o.title,
        location: remote ? `Remote${o.city ? ` (${o.city})` : ""}` : (cities[0] ?? "Poland"),
        remote_scope: scope,
        tags: [
          ...(o.requiredSkills ?? []).map((s) => s.name ?? "").filter(Boolean),
          o.experienceLevel ?? "",
        ].filter(Boolean),
        salary_min: paid?.from ?? null,
        salary_max: paid?.to ?? null,
        currency: paid?.currency?.toUpperCase() ?? null,
        salary_period: paid?.unit === "hour" ? "hour" : paid?.unit === "year" ? "year" : paid ? "month" : null,
        employment: paid?.type ?? o.workingTime ?? null,
        posted_at: o.publishedAt ?? null,
        description: null,
      });
    }
  }
  return out.filter(isRelevant);
}
