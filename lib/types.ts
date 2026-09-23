export const STATUSES = [
  "new",
  "shortlist",
  "drafted",
  "applied",
  "replied",
  "interviewing",
  "offer",
  "rejected",
  "archived",
] as const;

export type Status = (typeof STATUSES)[number];

/** "worldwide", "eu", "us", "other" (on-site), "unknown", or a country code like "pl". */
export type Scope = string;

/** What every source normalises a listing into. */
export type IncomingJob = {
  source: string;
  external_id: string;
  url: string;
  company: string;
  company_url?: string | null;
  title: string;
  location?: string | null;
  remote_scope?: Scope;
  employment?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  salary_period?: string | null;
  tags?: string[];
  description?: string | null;
  posted_at?: string | null;
};

/** A catalogue listing as the API returns it, scored for whoever asked. */
export type Job = Required<Omit<IncomingJob, "remote_scope">> & {
  id: number;
  remote_scope: Scope;
  discovered_at: string;
  fit_score: number;
  fit_reasons: string[];
};
