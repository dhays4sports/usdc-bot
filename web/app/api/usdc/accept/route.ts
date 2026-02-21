// usdc.bot/app/api/usdc/accept/route.ts
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

  const expectedSig = b64urlFromBuf(
    crypto.createHmac("sha256", SECRET).update(bodyB64).digest()
  );

  if (!timingSafeEq(sigB64, expectedSig)) return { ok: false, error: "Bad signature" };

  let payload: any;
  try {
    payload = JSON.parse(b64urlDecodeToString(bodyB64));
  } catch {
    return { ok: false, error: "Bad payload" };
  }

  return { ok: true, payload };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const token = String(body.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const v = verify(token);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const p = v.payload;

    // version
if (Number(p.v ?? 0) !== 1) {
  return NextResponse.json({ error: "Unsupported token version" }, { status: 400 });
}

// intent allowlist (tight)
const intent = String(p.intent ?? "");
if (intent !== "createEscrow") {
  return NextResponse.json({ error: "Unsupported intent" }, { status: 400 });
}

    // iss
    const iss = String(p.iss ?? "");
    if (iss !== "payments.chat" && iss !== "hub.chat") {
      return NextResponse.json({ error: "Wrong issuer" }, { status: 400 });
    }

    // aud
    const aud = String(p.aud ?? "");
    if (aud !== "usdc.bot" && aud !== "www.usdc.bot") {
      return NextResponse.json({ error: "Wrong audience" }, { status: 400 });
    }

    // exp
    const now = Math.floor(Date.now() / 1000);
    const exp = Number(p.exp ?? 0);
    if (!exp || now > exp) return NextResponse.json({ error: "Token expired" }, { status: 400 });

    // nonce replay lock
    const n = String(p.nonce ?? "").trim();
    if (!n) return NextResponse.json({ error: "Missing nonce" }, { status: 400 });

    const replayKey = `handoff:usdc:${n}`;
    const setRes = await kv.set(replayKey, "1", { nx: true, ex: Math.max(10, exp - now) } as any);

    // Handle redis client return differences cleanly without TS comparing to boolean
    if (!setRes) {
      return NextResponse.json({ error: "Token already used" }, { status: 400 });
    }

    const f = p.fields ?? {};
    const beneficiaryInput = String(f.beneficiaryInput ?? "").trim();
    const amount = String(f.amount ?? "").trim();
    const memo = typeof f.memo === "string" ? f.memo : undefined;
    const returnUrl = typeof f.returnUrl === "string" ? f.returnUrl : undefined;

    if (!beneficiaryInput) return NextResponse.json({ error: "Missing beneficiaryInput" }, { status: 400 });
    if (!amount) return NextResponse.json({ error: "Missing amount" }, { status: 400 });

    return NextResponse.json(
      {
        ok: true,
        intent: String(p.intent ?? "createEscrow"),
        fields: {
          beneficiaryInput,
          amount,
          memo: memo || undefined,
          returnUrl: returnUrl || undefined,
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
