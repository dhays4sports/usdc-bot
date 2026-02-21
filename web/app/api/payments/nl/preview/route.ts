// web/app/api/payments/nl/preview/route.ts
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type ParsedNL = {
  amount: string;
  asset: "USDC";
  payeeInput: string;
  memo?: string;
};

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeAmountString(v: string) {
  // remove commas/spaces, keep decimals
  return v.replace(/,/g, "").replace(/\s+/g, "").trim();
}

function isPositiveAmount(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

// A tiny NL parser (deliberately conservative).
// Supports:
// - "send $50 usdc to device.eth"
// - "pay 12.5 usdc to vitalik.eth for coffee"
// - "send 50 to 0xabc... memo rent"
function parseNL(raw: string): ParsedNL | null {
  const s = normalizeSpaces(String(raw ?? ""));
  if (!s) return null;

  // Capture:
  // 1 verb
  // 2 amount
  // 3 optional asset token "usdc"
  // 4 "to"
  // 5 payeeInput (single token; matches your UI expectation)
  // 6 optional memo tail preceded by "for" or "memo"
  const re =
    /^(send|pay)\s+\$?(\d[\d,]*(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  const m = s.match(re);
  if (!m) return null;

  const amount = normalizeAmountString(m[2] || "");
  const payeeInput = String(m[4] || "").trim();
  const memo = m[5] ? String(m[5]).trim() : undefined;

  if (!amount || !payeeInput) return null;

  return {
    amount,
    asset: "USDC",
    payeeInput,
    memo: memo || undefined,
  };
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "payments",
    action: "preview", // ✅ separate action key so preview doesn't compete with create
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
    const body = (await req.json().catch(() => ({} as any))) as any;
    const prompt = normalizeSpaces(String(body.prompt ?? ""));
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

    // Amount sanity
    if (!isPositiveAmount(parsed.amount)) {
      confidence = 0.25;
      warnings.push("Invalid amount.");
    }

    // Memo length sanity (match your create endpoint constraint)
    if (parsed.memo && parsed.memo.length > 180) {
      confidence = Math.min(confidence, 0.35);
      warnings.push("Memo is longer than 180 characters (will be rejected on create).");
    }

    // Resolve payee input via your existing resolver (absolute URL)
    const resolveUrl = new URL(
      `/api/resolve?input=${encodeURIComponent(parsed.payeeInput)}`,
      req.url
    );

    const rr = await fetch(resolveUrl, { method: "GET", cache: "no-store" });
    const rj = (await rr.json().catch(() => null)) as any;

    // If resolver is down or returns garbage, return ok:true with warnings
    if (!rj) {
      confidence = 0.25;
      warnings.push("Resolver error.");
      return NextResponse.json(
        {
          ok: true,
          payeeInput: parsed.payeeInput,
          payeeAddress: null,
          label: undefined,
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
      warnings.push(String(rj.message || "Could not resolve payee."));
      return NextResponse.json(
        {
          ok: true,
          payeeInput: parsed.payeeInput,
          payeeAddress: null,
          label: undefined,
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

    const payeeAddress = String(rj.address ?? "").trim() as `0x${string}`;
    const label = (typeof rj.label === "string" && rj.label.trim()) ? rj.label.trim() : undefined;

    // Extra safety hint
    if (!is0x40(payeeAddress)) {
      confidence = 0.25;
      warnings.push("Resolved address format looks invalid.");
      return NextResponse.json(
        {
          ok: true,
          payeeInput: parsed.payeeInput,
          payeeAddress: null,
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
    }

    // Small confidence adjustments (optional but helpful)
    if (parsed.payeeInput.toLowerCase().endsWith(".eth") || parsed.payeeInput.toLowerCase().endsWith(".base")) {
      confidence = Math.min(0.98, confidence + 0.02);
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
