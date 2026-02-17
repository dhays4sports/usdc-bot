// web/app/api/invoice/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";

const KEY = (id: string) => `invoice:${id}`;

function newId() {
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "invoice",
    action: "create",
    req,
    limit: 30,
    windowSec: 60,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again soon." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();

    const payeeInput = String(body.payeeInput ?? "").trim();
    const payeeAddress = String(body.payeeAddress ?? "").trim();

    const payerInput = String(body.payerInput ?? "").trim();
    const payerAddress = String(body.payerAddress ?? "").trim();

    const amount = String(body.amount ?? "").trim();
    const memo = String(body.memo ?? "").trim();

    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const dueAt = String(body.dueAt ?? "").trim();

    if (!is0x40(payeeAddress)) {
      return NextResponse.json({ error: "Invalid payee address" }, { status: 400 });
    }
    if (payerAddress && !is0x40(payerAddress)) {
      return NextResponse.json({ error: "Invalid payer address" }, { status: 400 });
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (memo && memo.length > 180) {
      return NextResponse.json({ error: "Memo too long" }, { status: 400 });
    }
    if (invoiceNumber && invoiceNumber.length > 64) {
      return NextResponse.json({ error: "Invoice # too long" }, { status: 400 });
    }
    if (dueAt && isNaN(Date.parse(dueAt))) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }

    const id = newId();
    const rec = {
      id,
      createdAt: new Date().toISOString(),
      updatedAt: undefined as string | undefined,

      version: "v0.1",
      status: "created", // created -> linked (proof) -> (paid later)
      network: "base",
      asset: "USDC",

      amount,
      memo: memo || undefined,

      invoiceNumber: invoiceNumber || undefined,
      dueAt: dueAt || undefined,

      payee: { input: payeeInput, address: payeeAddress as `0x${string}` },
      payer: payerAddress
        ? { input: payerInput, address: payerAddress as `0x${string}` }
        : payerInput
        ? { input: payerInput }
        : undefined,

      settlement:
        undefined as
          | undefined
          | { type: "usdc_bot_receipt"; value: string }
          | { type: "tx_hash"; value: `0x${string}` },

      context: body.context ?? { source: "invoice.chat" },
    };

    await kv.set(KEY(id), rec);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/invoice crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
