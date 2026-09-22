import { isPersistent, listMyJobs, saveMyJobs } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The durable side of the personal tracker, and the only shape an agent needs.
 *
 * My Jobs is authoritative in the viewer's browser. This route mirrors it to
 * SQLite so that a locally-run agent can read and edit the list. Where the
 * filesystem is read-only — the shared Vercel deployment — it refuses rather
 * than writing into a database that disappears with the instance.
 */

const notDurable = () =>
  Response.json(
    {
      mode: "browser-only",
      jobs: [],
      message:
        "This deployment has no writable storage, so My Jobs lives only in your browser. " +
        "Use Export on the My Jobs page to get your list as JSON, or run the tracker " +
        "locally (bun run dev) where it is kept in data/jobs.db.",
    },
    { status: 200 },
  );

export async function GET() {
  if (!isPersistent()) return notDurable();
  return Response.json({ mode: "sqlite", jobs: listMyJobs() });
}

export async function POST(request: Request) {
  if (!isPersistent()) return notDurable();

  const body = (await request.json().catch(() => null)) as
    | { jobs?: Record<string, unknown>[] }
    | Record<string, unknown>[]
    | null;
  if (!body) return Response.json({ error: "Body must be JSON" }, { status: 400 });

  const incoming = Array.isArray(body) ? body : (body.jobs ?? []);
  if (!Array.isArray(incoming)) {
    return Response.json({ error: "Send { jobs: [...] } or a bare array" }, { status: 400 });
  }

  // The browser sends origin as a nested object; the table stores it flat.
  const rows = incoming.map((j) => {
    const origin = j.origin as { source?: string; external_id?: string } | null | undefined;
    return { ...j, origin_source: origin?.source ?? null, origin_id: origin?.external_id ?? null };
  });

  return Response.json({ mode: "sqlite", ...saveMyJobs(rows as never) });
}
