import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { newId } from "@/lib/remitId";
import type { RemittanceRecord } from "@/lib/remitTypes";

const KEY = (id: string) => `remit:${id}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = newId();
    const createdAt = new Date().toISOString();

    const recipientAddress = String(body.recipientAddress ?? "").trim();
    const amountStr = String(body.amount ?? "").trim();
    const memoStr = String(body.memo ?? "").trim();
    const recipientInputStr = String(body.recipientInput ?? "").trim();

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
        address: recipientAddress,
      },
      memo: memoStr,
      reference: body.reference ? String(body.reference) : undefined,
      settlement: body.settlement ?? undefined,
    };

    // Minimal validation
    if (!rec.amount || isNaN(Number(rec.amount))) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(rec.recipient.address)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 });
    }
    if (rec.memo && rec.memo.length > 180) {
      return NextResponse.json({ error: "Memo too long" }, { status: 400 });
    }

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
