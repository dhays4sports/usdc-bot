import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";

const KEY = (id: string) => `remit:${id}`;

type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` };

function normalizeSettlement(input: any): Settlement | null {
  if (!input || typeof input !== "object") return null;

  let type = String(input.type ?? "").trim();
  let value = String(input.value ?? "").trim();

  // Allow past versions
  if (type === "basescan_tx") type = "tx_hash";

  // If someone passes a Basescan URL as "value", extract the hash
  if (value.includes("basescan.org/tx/")) {
    const parts = value.split("/tx/");
    const hash = parts[1]?.split("?")[0]?.split("#")[0]?.trim();
    if (hash) value = hash;
  }

  if (type === "usdc_bot_receipt") {
    // ID is not necessarily numeric; allow any non-empty segment after /e/
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(value)) return null;
    return { type: "usdc_bot_receipt", value };
  }

  if (type === "tx_hash") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null;
    return { type: "tx_hash", value: value as `0x${string}` };
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
const rl = await rateLimit({
  surface: "remit",
  action: "replace_proof", // same for link/replace
  req,
  limit: 20,
  windowSec: 60,
});

if (!rl.ok) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again soon." },
    { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
  );
}

    const { id } = await ctx.params;
    const body = await req.json();
    const existing: any = await kv.get(KEY(id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settlement = normalizeSettlement(body?.settlement);
    if (!settlement) {
      return NextResponse.json(
        { error: "Invalid settlement proof. Paste a tx hash, Basescan URL, or usdc.bot receipt link." },
        { status: 400 }
      );
    }

    const updated = {
      ...existing,
      settlement,
      status: "linked",
      updatedAt: new Date().toISOString(),
    };

    await kv.set(KEY(id), updated);
    return NextResponse.json({ ok: true, settlement }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/remit/[id] crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
