import { upsertJobs } from "@/lib/db";
import { BROWSER_NORMALISERS, type BrowserSource } from "@/lib/sources/browser";
import type { IncomingJob } from "@/lib/types";

export const runtime = "nodejs";

// Open CORS on purpose: this endpoint exists so a snippet running on
// justjoin.it or workatastartup.com can push what it sees straight here.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  let body: { source?: string; rows?: unknown[]; jobs?: IncomingJob[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400, headers: CORS });
  }

  let incoming: IncomingJob[] = [];

  if (body.jobs?.length) {
    // Already normalised (e.g. from a script).
    incoming = body.jobs;
  } else if (body.source && body.rows?.length) {
    const normalise = BROWSER_NORMALISERS[body.source as BrowserSource];
    if (!normalise) {
      return Response.json(
        { error: `No normaliser for "${body.source}". Known: ${Object.keys(BROWSER_NORMALISERS).join(", ")}` },
        { status: 400, headers: CORS },
      );
    }
    incoming = normalise(body.rows as Record<string, unknown>[]);
  } else {
    return Response.json(
      { error: "Send { source, rows } or { jobs }" },
      { status: 400, headers: CORS },
    );
  }

  const { inserted, updated } = upsertJobs(incoming);
  return Response.json(
    { received: body.rows?.length ?? body.jobs?.length ?? 0, normalised: incoming.length, inserted, updated },
    { headers: CORS },
  );
}
