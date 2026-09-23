import { isPersistent, listMyJobs, saveMyJobs, type MyJobRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const browserOnly = () =>
  Response.json({
    mode: "browser-only",
    jobs: [],
    message:
      "This deployment has no durable storage, so My jobs lives in your browser. " +
      "Use Export to get it as JSON, or run the app locally.",
  });

export async function GET() {
  if (!isPersistent()) return browserOnly();
  return Response.json({ mode: "sqlite", jobs: listMyJobs() });
}

export async function POST(request: Request) {
  if (!isPersistent()) return browserOnly();

  const body = await request.json().catch(() => null);
  const jobs: unknown = Array.isArray(body) ? body : body?.jobs;
  if (!Array.isArray(jobs)) return Response.json({ error: "Send { jobs: [...] }" }, { status: 400 });

  // The browser keeps origin nested; the table keeps it flat.
  const rows = jobs.map((j: Record<string, any>) => ({
    ...j,
    origin_source: j.origin?.source ?? j.origin_source ?? null,
    origin_id: j.origin?.external_id ?? j.origin_id ?? null,
  })) as Partial<MyJobRow>[];

  return Response.json({ mode: "sqlite", ...saveMyJobs(rows) });
}
