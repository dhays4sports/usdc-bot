import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";

const KEY = (id: string) => `payment:${id}`;

// Accept either:
// - string: tx hash OR usdc.bot receipt OR basescan tx url
// - object: { type, value }
function normalizeSettlement(
  input: any
):
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` }
  | null {
  if (!input) return null;

  // ✅ allow raw string input (best for UI + agents + curl)
  if (typeof input === "string") {
    const v = input.trim();
    if (!v) return null;

    // usdc.bot receipt
    if (/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(v)) {
      return { type: "usdc_bot_receipt", value: v };
    }

    // basescan tx url -> extract hash
    if (v.includes("basescan.org/tx/")) {
      const parts = v.split("/tx/");
      const hash = parts[1]?.split("?")[0]?.split("#")[0]?.trim();
      if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
        return { type: "tx_hash", value: hash as `0x${string}` };
      }
      return null;
    }

    // raw tx hash
    if (/^0x[a-fA-F0-9]{64}$/.test(v)) {
      return { type: "tx_hash", value: v as `0x${string}` };
    }

    return null;
  }

  // ✅ object input
  if (typeof input !== "object") return null;

  const type = String(input.type ?? "").trim();
  const value = String(input.value ?? "").trim();

  if (type === "usdc_bot_receipt") {
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(value)) return null;
    return { type: "usdc_bot_receipt", value };
  }

  // accept both "tx_hash" and "basescan_tx" and normalize to tx_hash
  if (type === "tx_hash" || type === "basescan_tx") {
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
    const { id } = await ctx.params;

    const rl = await rateLimit({
      surface: "payments",
      action: "link_proof",
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

    const body = await req.json();
    const existing: any = await kv.get(KEY(id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // allow either body.settlement OR body.proof (nice compatibility)
    const settlement = normalizeSettlement(body?.settlement ?? body?.proof);
    if (!settlement) return NextResponse.json({ error: "Invalid settlement" }, { status: 400 });

    const updated = {
      ...existing,
      settlement,
      status: "linked",
      updatedAt: new Date().toISOString(),
    };

    await kv.set(KEY(id), updated);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
