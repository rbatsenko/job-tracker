import { del, get, put } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stores encrypted copies of people's lists. The id is a hash of their sync code
 * and the payload is encrypted with a key derived from it, so this route only ever
 * sees ciphertext. Needs BLOB_READ_WRITE_TOKEN; without it, sync is simply off.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const available = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const validId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{64}$/.test(id);
const pathFor = (id: string) => `sync/${id}.json`;

const off = () => Response.json({ available: false, error: "Sync isn't set up on this deployment." }, { status: 503 });

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ available: available() });
  if (!available()) return off();
  if (!validId(id)) return Response.json({ error: "Bad id." }, { status: 400 });

  const found = await get(pathFor(id), { access: "private", useCache: false });
  if (!found || found.statusCode !== 200) return Response.json({ error: "Nothing stored under that code." }, { status: 404 });
  return new Response(found.stream, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!available()) return off();
  const body = (await request.json().catch(() => null)) as { id?: unknown; iv?: unknown; data?: unknown } | null;
  if (!body || !validId(body.id) || typeof body.iv !== "string" || typeof body.data !== "string") {
    return Response.json({ error: "Send { id, iv, data }." }, { status: 400 });
  }
  if (body.data.length > MAX_BYTES) return Response.json({ error: "That list is too large to sync." }, { status: 413 });

  await put(pathFor(body.id), JSON.stringify({ v: 1, iv: body.iv, data: body.data }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!available()) return off();
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || !validId(body.id)) return Response.json({ error: "Send { id }." }, { status: 400 });
  await del(pathFor(body.id));
  return Response.json({ ok: true });
}
