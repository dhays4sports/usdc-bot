import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { newAuthId } from "@/lib/authorizeId";
import { rateLimit } from "@/lib/rateLimit";
import type { AuthorizationRecord } from "@/lib/authorizeTypes";

const KEY = (id: string) => `authorize:${id}`;

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

// ✅ exact proof union from your type
type AuthProof = NonNullable<AuthorizationRecord["proof"]>;

// ✅ template-literal helper for 0x... values
type Hex0x = `0x${string}`;

function normalizeProof(input: any): AuthProof | null {
  if (!input) return null;

  // allow passing a raw string too (nice for agents / curl)
  if (typeof input === "string") {
    const v = input.trim();
    if (/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(v)) {
      return { type: "usdc_bot_receipt", value: v } as AuthProof;
    }
    if (/^0x[a-fA-F0-9]{64}$/.test(v)) {
      return { type: "basescan_tx", value: v as Hex0x } as AuthProof;
    }
    return null;
  }

  if (typeof input !== "object") return null;

  const type = String(input.type ?? "").trim();
  const value = String(input.value ?? "").trim();

  if (type === "usdc_bot_receipt") {
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(value)) return null;
    return { type: "usdc_bot_receipt", value } as AuthProof;
  }

  if (type === "basescan_tx") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null;
    return { type: "basescan_tx", value: value as Hex0x } as AuthProof;
  }

  return null;
}

export async function POST(req: Request) {
  try {
const rl = await rateLimit({
  surface: "authorize",
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
    const id = newAuthId();
    const createdAt = new Date().toISOString();

    const spenderInput = String(body.spenderInput ?? "").trim() || String(body.spenderAddress ?? "").trim();
    const spenderAddress = String(body.spenderAddress ?? "").trim();
    const scope = String(body.scope ?? "").trim() || "pay_usdc";
    const limit = String(body.limit ?? "").trim();
    const memo = String(body.memo ?? "").trim();
    const expiresAt = String(body.expiresAt ?? "").trim();

    if (!is0x40(spenderAddress)) {
      return NextResponse.json({ error: "Invalid spender address" }, { status: 400 });
    }

    // ✅ normalize proof into the exact union type
    const proof = normalizeProof(body?.proof);

    const rec: AuthorizationRecord = {
      id,
      createdAt,
      version: "mvv-1",
      status: proof ? "linked" : "proposed",
      network: "base",
      asset: "USDC",
      spender: { input: spenderInput, address: spenderAddress as `0x${string}` },
      scope,
      limit: limit || undefined,
      expiresAt: expiresAt || undefined,
      memo: memo || undefined,
      proof: proof ?? undefined,
    };

    await kv.set(KEY(id), rec);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/authorize crashed:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
