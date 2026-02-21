// web/app/api/usdc/commit/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const SECRET = process.env.HUB_HANDOFF_SECRET?.trim() || "";

// ---- helpers ----
function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

function isPositiveAmount(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function cleanMemo(v: any) {
  if (typeof v !== "string") return undefined;
  const m = v.trim();
  if (!m) return undefined;
  // keep consistent with payments memo policy (<= 180)
  return m.length > 180 ? m.slice(0, 180) : m;
}

// ---- types ----
type CommitBody = {
  // Payment receipt id (so we can construct return link)
  paymentId: string;

  // Pre-fill fields for usdc.bot
  fields: {
    // Cleanest: a name/address string (often you pass the 0x here; that’s fine)
    beneficiaryInput?: string;

    // Best: canonical 0x address (if known)
    beneficiaryAddress?: `0x${string}`;

    amount?: string;
    memo?: string;
    returnUrl?: string;
  };

  // Optional context chain
  context?: any;
};

export async function POST(req: Request) {
  // ✅ rate limit (payments surface, commit action)
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

    // ✅ Align to your payments schema:
    // - beneficiaryInput = whatever your UI stored as "payee.input" (string)
    // - beneficiaryAddress = the canonical 0x "payee.address" when available
    const beneficiaryInput = String(f.beneficiaryInput ?? "").trim();
    const beneficiaryAddress = f.beneficiaryAddress ? String(f.beneficiaryAddress).trim() : "";

    const amount = String(f.amount ?? "").trim();
    const memo = cleanMemo(f.memo);

    if (!beneficiaryInput) {
      return NextResponse.json({ error: "Missing fields.beneficiaryInput" }, { status: 400 });
    }

    // If beneficiaryAddress is provided, validate it
    if (beneficiaryAddress && !is0x40(beneficiaryAddress)) {
      return NextResponse.json({ error: "Invalid fields.beneficiaryAddress" }, { status: 400 });
    }

    if (!amount) return NextResponse.json({ error: "Missing fields.amount" }, { status: 400 });
    if (!isPositiveAmount(amount)) {
      return NextResponse.json({ error: "Invalid fields.amount" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const ttlSec = 120;

    // Return to the payment receipt by default
    const returnUrl =
      String(f.returnUrl ?? "").trim() || `https://payments.chat/p/${encodeURIComponent(paymentId)}`;

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
        // only include beneficiaryAddress when present + valid
        beneficiaryAddress: beneficiaryAddress ? (beneficiaryAddress as `0x${string}`) : undefined,
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

    // ✅ redirect into usdc.bot app path with signed handoff token
    const redirect =
      `https://usdc.bot/app?h=${encodeURIComponent(token)}` + `&return=${encodeURIComponent(returnUrl)}`;

    return NextResponse.json({ ok: true, redirect, ttlSec }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
