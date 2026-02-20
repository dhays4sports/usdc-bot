// web/app/api/usdc/commit/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

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

type CommitBody = {
  // Payment receipt id (so we can construct return link)
  paymentId: string;

  // Pre-fill fields for usdc.bot
  fields: {
    beneficiaryInput?: string; // can be ENS/name.base/0x
    beneficiaryAddress?: `0x${string}`; // optional
    amount?: string;
    memo?: string;
    returnUrl?: string;
  };

  // Optional context chain
  context?: any;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CommitBody>;

    const paymentId = String(body.paymentId ?? "").trim();
    if (!paymentId) return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });

    const f = (body.fields ?? {}) as CommitBody["fields"];

    const beneficiaryInput = String(f.beneficiaryInput ?? "").trim();
    const amount = String(f.amount ?? "").trim();
    const memo = typeof f.memo === "string" ? f.memo : undefined;

    if (!beneficiaryInput) return NextResponse.json({ error: "Missing fields.beneficiaryInput" }, { status: 400 });
    if (!amount) return NextResponse.json({ error: "Missing fields.amount" }, { status: 400 });

    const now = Math.floor(Date.now() / 1000);
    const ttlSec = 120;

    // Construct a return URL back to this exact payment receipt
    // (You can change this if your host routing differs.)
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
        upstream: body.context ?? undefined, // carry hub context if you want
      },
    };

    const token = sign(payload);

    // Send token + return url. usdc.bot can also accept return directly as a query param.
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
