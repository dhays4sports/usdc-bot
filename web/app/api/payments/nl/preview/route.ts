export const runtime = "nodejs";

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

  // Examples supported:
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

function isValidAmount(v: string) {
  const n = Number(v);
  return !!v && !isNaN(n) && n > 0;
}

export async function POST(req: Request) {
  // ✅ Preview endpoint should NOT mint intents, so do NOT use action:"create"
  // Use a softer bucket (or add "preview" to ACTIONS later).
  const rl = await rateLimit({
    surface: "payments",
    action: "link_proof",
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

    if (!isValidAmount(parsed.amount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const resolveUrl = new URL(`/api/resolve?input=${encodeURIComponent(parsed.payeeInput)}`, req.url);

const rr = await fetch(resolveUrl, { method: "GET", cache: "no-store" });
const rj = await rr.json().catch(() => null);

if (!rj) return NextResponse.json({ error: "Resolver error." }, { status: 500 });
if (!rj.ok) return NextResponse.json({ error: rj.message || "Could not resolve." }, { status: 400 });

const payeeAddress = rj.address as `0x${string}`;
const label = rj.label as string | undefined;

    // Build warnings + confidence
    const warnings: string[] = [];
    let confidence = 0.92;

    if (!r.ok) {
      confidence = 0.25;
      warnings.push(r.message || "Could not resolve payee.");
    } else {
      // Heuristic: raw 0x gets higher confidence than name resolution
      if (/^0x[a-fA-F0-9]{40}$/.test(parsed.payeeInput)) confidence = 0.98;
      if (parsed.amount.includes(".")) warnings.push("Decimal amount detected — double-check.");
      if (parsed.memo && parsed.memo.length > 180) warnings.push("Memo over 180 chars — it will be rejected.");
    }

    // ✅ IMPORTANT: do not write to KV; only return preview payload
    return NextResponse.json(
      {
        payeeInput: parsed.payeeInput,
        payeeAddress: r.ok ? r.address : null,
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
