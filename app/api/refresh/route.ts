import { isPersistent, rescopeAll, rescoreAll } from "@/lib/db";
import { refreshSources } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    sources?: string[];
    rescore?: boolean;
    rescope?: boolean;
  };

  const results = await refreshSources(body.sources);
  const rescoped = body.rescope ? rescopeAll() : null;
  const rescored = body.rescore ? rescoreAll() : 0;

  return Response.json({ results, rescoped, rescored, persistent: isPersistent() });
}
