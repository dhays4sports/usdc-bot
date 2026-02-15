import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { newAuthId } from "@/lib/authorizeId";
import type { AuthorizationRecord } from "@/lib/authorizeTypes";

const KEY = (id: string) => `authorize:${id}`;

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

function normalizeProof(input: any) {
  if (!input || typeof input !== "object") return null;

  const type = String(input.type ?? "").trim();
  const value = String(input.value ?? "").trim();

  if (type === "usdc_bot_receipt") {
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(value)) return null;
    return { type, value };
  }

  if (type === "basescan_tx") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null;
    return { type, value };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const id = newAuthId();
    const createdAt = new Date().toISOString();

    const spenderInput = String(body.spenderInput ?? "").trim();
    const spenderAddress = String(body.spenderAddress ?? "").trim();
    const scope = String(body.scope ?? "").trim();
    const limit = String(body.limit ?? "").trim();
    const memo = String(body.memo ?? "").trim();
    const expiresAt = String(body.expiresAt ?? "").trim();

    if (!scope) {
      return NextResponse.json({ error: "Scope is required" }, { status: 400 });
    }
    if (!is0x40(spenderAddress)) {
      return NextResponse.json({ error: "Invalid spender address" }, { status: 400 });
    }

    // If proof is provided, validate it. If invalid, hard-fail (prevents poison records).
    const proof = body?.proof ? normalizeProof(body.proof) : undefined;
    if (body?.proof && !proof) {
      return NextResponse.json({ error: "Invalid proof" }, { status: 400 });
    }

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
