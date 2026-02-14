import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KEY = (id: string) => `authorize:${id}`;

function normalizeProof(input: any) {
  if (!input || typeof input !== "object") return null;

  const type = String(input.type ?? "").trim();
  const value = String(input.value ?? "").trim();

  if (type === "usdc_bot_receipt") {
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(value)) return null;
    return { type, value };
  }

  if (type === "basescan_tx") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null;
    return { type, value };
  }

  return null;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rec = await kv.get(KEY(id));
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rec, { status: 200 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const existing: any = await kv.get(KEY(id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // revoke
    if (body?.action === "revoke") {
      const updated = { ...existing, status: "revoked", updatedAt: new Date().toISOString() };
      await kv.set(KEY(id), updated);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // link / replace proof
    const proof = normalizeProof(body?.proof);
    if (!proof) return NextResponse.json({ error: "Invalid proof" }, { status: 400 });

    const updated = {
      ...existing,
      proof,
      status: "linked",
      updatedAt: new Date().toISOString(),
    };

    await kv.set(KEY(id), updated);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/authorize/[id] crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
