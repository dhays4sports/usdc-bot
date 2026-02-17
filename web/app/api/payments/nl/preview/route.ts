export const runtime = "nodejs";

// web/app/api/payments/nl/preview/route.ts
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

function parseNL(raw: string): {
  amount: string;
  asset: "USDC";
  payeeInput: string;
  memo?: string;
} | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  // Supports:
  // "send $50 usdc to device.eth"
  // "pay 12.5 usdc to vitalik.eth for coffee"
  // "send 50 to 0xabc... memo rent"
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

function isPositiveAmount(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "payments",
    action: "create", // OK to reuse; or add "preview" later if you want
    req,
    limit: 60,
    windowSec: 60,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again soon." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const parsed = parseNL(prompt);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse. Try: "send $50 usdc to device.eth"' },
        { status: 400 }
      );
    }

    const warnings: string[] = [];
    let confidence = 0.92;

    if (!isPositiveAmount(parsed.amount)) {
      confidence = 0.25;
      warnings.push("Invalid amount.");
    }

    // ✅ Server-side: resolve using ABSOLUTE URL (not /api/resolve relative)
    const resolveUrl = new URL(
      `/api/resolve?input=${encodeURIComponent(parsed.payeeInput)}`,
      req.url
    );

    const rr = await fetch(resolveUrl, { method: "GET", cache: "no-store" });
    const rj = await rr.json().catch(() => null);

    if (!rj) {
      confidence = 0.25;
      warnings.push("Resolver error.");
      return NextResponse.json(
        {
          ok: true,
          payeeInput: parsed.payeeInput,
          payeeAddress: null,
          amount: parsed.amount,
          memo: parsed.memo,
          asset: "USDC",
          network: "base",
          confidence,
          warnings,
        },
        { status: 200 }
      );
    }

    if (!rj.ok) {
      confidence = 0.25;
      warnings.push(rj.message || "Could not resolve payee.");
      return NextResponse.json(
        {
          ok: true,
          payeeInput: parsed.payeeInput,
          payeeAddress: null,
          amount: parsed.amount,
          memo: parsed.memo,
          asset: "USDC",
          network: "base",
          confidence,
          warnings,
        },
        { status: 200 }
      );
    }

    const payeeAddress = rj.address as `0x${string}`;
    const label = (rj.label as string | undefined) ?? undefined;

    // Extra safety hint
    if (!/^0x[a-fA-F0-9]{40}$/.test(payeeAddress)) {
      confidence = 0.25;
      warnings.push("Resolved address format looks invalid.");
    }

    return NextResponse.json(
      {
        ok: true,
        payeeInput: parsed.payeeInput,
        payeeAddress,
        label,
        amount: parsed.amount,
        memo: parsed.memo,
        asset: "USDC",
        network: "base",
        confidence,
        warnings,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
