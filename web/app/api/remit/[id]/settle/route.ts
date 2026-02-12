import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { RemittanceRecord } from "@/lib/remitTypes";

const KEY = (id: string) => `remit:${id}`;

function isTxHash(s: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(s);
}

function isUsdcBotReceiptUrl(s: string) {
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return false;
    // allow both usdc.bot and www.usdc.bot
    if (u.hostname !== "usdc.bot" && u.hostname !== "www.usdc.bot") return false;
    // your receipts are /e/[id] (and maybe /e/123)
    return u.pathname.startsWith("/e/");
  } catch {
    return false;
  }
}

type Settlement = { type: "tx_hash" | "usdc_bot_receipt"; value: string };

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const raw = String(body?.value ?? "").trim();

    if (!raw) {
      return NextResponse.json({ error: "Missing settlement value" }, { status: 400 });
    }

    const settlement: Settlement | null = isTxHash(raw)
      ? { type: "tx_hash", value: raw }
      : isUsdcBotReceiptUrl(raw)
        ? { type: "usdc_bot_receipt", value: raw }
        : null;

    if (!settlement) {
      return NextResponse.json(
        { error: "Invalid settlement. Provide a tx hash or a usdc.bot receipt URL." },
        { status: 400 }
      );
    }

    const rec = (await kv.get(KEY(id))) as RemittanceRecord | null;
    if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Idempotent update
    const next: RemittanceRecord = {
      ...rec,
      settlement,
      status: "linked",
    };

    await kv.set(KEY(id), next);

    return NextResponse.json({ ok: true, id, settlement }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/remit/[id]/settle crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
