import { getJob, updateJob } from "@/lib/db";
import { STATUSES } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getJob(Number(id));
  return job ? Response.json(job) : new Response("Not found", { status: 404 });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const patch = (await request.json()) as Record<string, unknown>;

  if (patch.status && !STATUSES.includes(patch.status as never)) {
    return Response.json({ error: `Unknown status: ${patch.status}` }, { status: 400 });
  }
  if ("starred" in patch) patch.starred = patch.starred ? 1 : 0;

  const job = updateJob(Number(id), patch);
  return job ? Response.json(job) : new Response("Not found", { status: 404 });
}
