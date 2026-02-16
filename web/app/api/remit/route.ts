import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { newId } from "@/lib/remitId";
import type { RemittanceRecord } from "@/lib/remitTypes";
import { rateLimit } from "@/lib/rateLimit";

const KEY = (id: string) => `remit:${id}`;
const asHexAddress = (v: string) => v as `0x${string}`;

export async function POST(req: Request) {
  try {
const rl = await rateLimit({
  surface: "remit",
  action: "create",
  req,
  limit: 10,
  windowSec: 60,
});

if (!rl.ok) {
  return NextResponse.json(
    { error: "Rate limit exceeded. Try again soon." },
    { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
  );
}

    const body = await req.json();
    const id = newId();
    const createdAt = new Date().toISOString();

    const recipientAddress = String(body.recipientAddress ?? "").trim();
    const amountStr = String(body.amount ?? "").trim();
    const memoStr = String(body.memo ?? "").trim();
    const recipientInputStr = String(body.recipientInput ?? "").trim();

    // Minimal validation (do this before building `rec`)
    if (!amountStr || isNaN(Number(amountStr))) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }
    if (memoStr && memoStr.length > 180) {
      return NextResponse.json({ error: "Memo too long" }, { status: 400 });
    }

    const rec: RemittanceRecord = {
      id,
      createdAt,
      version: "mvv-1",
      status: body.settlement ? "linked" : "proposed",
      network: "base",
      asset: "USDC",
      amount: amountStr,
      recipient: {
        input: recipientInputStr,
        address: asHexAddress(recipientAddress),
      },
      memo: memoStr,
      reference: body.reference ? String(body.reference) : undefined,
      settlement: body.settlement ?? undefined,
    };

    await kv.set(KEY(id), rec);

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/remit crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
