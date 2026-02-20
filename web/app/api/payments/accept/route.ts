// web/app/api/payments/accept/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import crypto from "crypto";

export const runtime = "nodejs";

const SECRET = process.env.HUB_HANDOFF_SECRET?.trim() || "";

function b64urlDecodeToString(s: string) {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

function b64urlFromBuf(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function timingSafeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verify(token: string): { ok: true; payload: any } | { ok: false; error: string } {
  if (!SECRET) return { ok: false, error: "Missing HUB_HANDOFF_SECRET" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Malformed token" };

  const [bodyB64, sigB64] = parts;

  const expectedSig = b64urlFromBuf(crypto.createHmac("sha256", SECRET).update(bodyB64).digest());
  if (!timingSafeEq(sigB64, expectedSig)) return { ok: false, error: "Bad signature" };

  let payload: any;
  try {
    payload = JSON.parse(b64urlDecodeToString(bodyB64));
  } catch {
    return { ok: false, error: "Bad payload" };
  }

  return { ok: true, payload };
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

// Normalize setnx-like return values across clients:
// - number: 1 success, 0 fail
// - string: "1"/"0"/"OK"
// - boolean: true/false
// - null/undefined: fail
function isSetSuccess(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v === "boolean") return v === true;
  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    return s === "1" || s === "OK" || s === "TRUE";
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const token = String(body.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const v = verify(token);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const p = v.payload;

    // issuer
    if (String(p.iss ?? "") !== "hub.chat") {
      return NextResponse.json({ error: "Wrong issuer" }, { status: 400 });
    }

    // audience (payments only)
    const aud = String(p.aud ?? "");
    if (aud !== "payments.chat" && aud !== "www.payments.chat") {
      return NextResponse.json({ error: "Wrong audience" }, { status: 400 });
    }

    // TTL
    const now = Math.floor(Date.now() / 1000);
    const exp = Number(p.exp ?? 0);
    if (!exp || now > exp) return NextResponse.json({ error: "Token expired" }, { status: 400 });

    // nonce
    const n = String(p.nonce ?? "").trim();
    if (!n) return NextResponse.json({ error: "Missing nonce" }, { status: 400 });

    // replay protection
    const replayKey = `handoff:payments:${n}`;

    // Prefer setnx if present; fall back to kv.set({ nx:true }) if you ever need to
    const setRes = await (kv as any).setnx(replayKey, "1");

    if (!isSetSuccess(setRes)) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    // expire replay lock at token expiry
    await kv.expire(replayKey, Math.max(10, exp - now));

    const f = p.fields ?? {};
    const payeeInput = String(f.payeeInput ?? "").trim();
    const payeeAddressRaw = String(f.payeeAddress ?? "").trim();
    const amount = String(f.amount ?? "").trim();
    const memo = String(f.memo ?? "").trim();
    const label = f.label ? String(f.label) : undefined;

    if (!payeeInput) return NextResponse.json({ error: "Missing payeeInput" }, { status: 400 });
    if (!is0x40(payeeAddressRaw)) {
      return NextResponse.json({ error: "Invalid payeeAddress" }, { status: 400 });
    }

    const nAmount = Number(amount);
    if (!amount || Number.isNaN(nAmount) || nAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (memo && memo.length > 180) {
      return NextResponse.json({ error: "Memo too long" }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        intent: String(p.intent ?? "pay"),
        fields: {
          payeeInput,
          payeeAddress: payeeAddressRaw as `0x${string}`,
          amount,
          memo: memo || undefined,
          asset: "USDC",
          network: "base",
          label,
        },
        context: p.context ?? undefined,
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
