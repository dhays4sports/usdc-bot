import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { resolveNameToAddress } from "@/lib/nameResolve";

function parseNL(raw: string): {
  amount: string;
  asset: "USDC";
  payeeInput: string;
  memo?: string;
} | null {
  const s = raw.trim();

  // Examples it supports:
  // "send $50 usdc to device.eth"
  // "pay 12.5 usdc to vitalik.eth for coffee"
  // "send 50 to 0xabc... memo rent"
  //
  // We keep it strict + simple on purpose.
  const re =
    /^(send|pay)\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  const m = s.match(re);
  if (!m) return null;

  const amount = m[2];
  const payeeInput = m[4];
  const memo = m[5]?.trim();

  return {
    amount,
    asset: "USDC",
    payeeInput,
    memo: memo || undefined,
  };
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "payments",
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
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const parsed = parseNL(prompt);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse. Try: "send $50 usdc to device.eth"' },
        { status: 400 }
      );
    }

    const r = await resolveNameToAddress(parsed.payeeInput);
    if (!r.ok) return NextResponse.json({ error: r.message }, { status: 400 });

    // Reuse your existing /api/payments POST
    const res = await fetch(new URL("/api/payments", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        payeeInput: parsed.payeeInput,
        payeeAddress: r.address,
        amount: parsed.amount,
        memo: parsed.memo,
        asset: "USDC",
        network: "base",
        context: { source: "payments.chat", mode: "nl", prompt },
      }),
    });

    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      return NextResponse.json({ error: json?.error || "Failed" }, { status: res.status });
    }

    return NextResponse.json({ ok: true, id: json.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
