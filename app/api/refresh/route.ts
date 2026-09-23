import { isPersistent, rescopeAll } from "@/lib/db";
import { refreshSources } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { sources?: string[]; rescope?: boolean };
  const results = await refreshSources(body.sources);
  const rescoped = body.rescope ? rescopeAll() : null;
  return Response.json({ results, rescoped, persistent: isPersistent() });
}
