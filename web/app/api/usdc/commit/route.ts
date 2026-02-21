// web/app/api/usdc/commit/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const SECRET = process.env.HUB_HANDOFF_SECRET?.trim() || "";

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: any) {
  if (!SECRET) throw new Error("Missing HUB_HANDOFF_SECRET");
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(body).digest());
  return `${body}.${sig}`;
}

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

function isPositiveAmount(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

type CommitBody = {
  paymentId: string;
  fields: {
    beneficiaryInput?: string;
    beneficiaryAddress?: `0x${string}`;
    amount?: string;
    memo?: string;
    returnUrl?: string;
  };
  context?: any;
};

export async function POST(req: Request) {
  // ✅ rate limit
  const rl = await rateLimit({
    surface: "payments",
    action: "commit",
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
    const body = (await req.json().catch(() => ({}))) as Partial<CommitBody>;

    const paymentId = String(body.paymentId ?? "").trim();
    if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

    const f = (body.fields ?? {}) as CommitBody["fields"];

    const beneficiaryInput = String(f.beneficiaryInput ?? "").trim();
    const amount = String(f.amount ?? "").trim();
    const memo = typeof f.memo === "string" ? f.memo : undefined;

    if (!beneficiaryInput) {
      return NextResponse.json({ error: "Missing fields.beneficiaryInput" }, { status: 400 });
    }
    if (!amount) return NextResponse.json({ error: "Missing fields.amount" }, { status: 400 });
    if (!isPositiveAmount(amount)) {
      return NextResponse.json({ error: "Invalid fields.amount" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const ttlSec = 120;

    const returnUrl =
      String(f.returnUrl ?? "").trim() ||
      `https://payments.chat/p/${encodeURIComponent(paymentId)}`;

    const payload = {
      v: 1,
      iss: "payments.chat",
      aud: "usdc.bot",
      iat: now,
      exp: now + ttlSec,
      nonce: nonce(),
      intent: "createEscrow",
      fields: {
        beneficiaryInput,
        beneficiaryAddress: f.beneficiaryAddress ?? undefined,
        amount,
        memo,
        returnUrl,
      },
      context: {
        source: "payments.chat",
        paymentId,
        upstream: body.context ?? undefined,
      },
    };

    const token = sign(payload);

    const redirect =
      `https://usdc.bot/app?h=${encodeURIComponent(token)}` +
      `&return=${encodeURIComponent(returnUrl)}`;

    return NextResponse.json({ ok: true, redirect, ttlSec }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
