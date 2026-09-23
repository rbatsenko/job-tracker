import { isPersistent, reclassifyAll, rescopeAll } from "@/lib/db";
import { refreshSources } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { sources?: string[]; rescope?: boolean };
  const results = await refreshSources(body.sources);
  // Re-reads locations and fields from the stored titles, for when the lists change.
  const rescoped = body.rescope ? { ...rescopeAll(), fields: reclassifyAll().changed } : null;
  return Response.json({ results, rescoped, persistent: isPersistent() });
}
