// web/app/api/hub/commit/route.ts
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
  intent: string; // e.g. "pay"
  route: {
    aud: string;   // e.g. "payments.chat"
    path: string;  // e.g. "/new" or "/payments/new" depending on how you route on that host
  };
  fields: {
    payeeInput?: string;
    payeeAddress?: `0x${string}` | null;
    label?: string;
    amount?: string;
    memo?: string;
    asset?: string;
    network?: string;
  };
  context?: any;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CommitBody>;

    const intent = String(body.intent ?? "").trim();
    const aud = String(body.route?.aud ?? "").trim();
    const path = String(body.route?.path ?? "").trim();

    if (!intent) return NextResponse.json({ error: "Missing intent" }, { status: 400 });
    if (!aud) return NextResponse.json({ error: "Missing route.aud" }, { status: 400 });
    if (!path.startsWith("/")) {
      return NextResponse.json({ error: "route.path must start with /" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const ttlSec = 90;

    const payload = {
      v: 1,
      iss: "hub.chat",
      aud,
      iat: now,
      exp: now + ttlSec,
      nonce: nonce(),
      intent,
      fields: body.fields ?? {},
      context: body.context ?? undefined,
    };

    const token = sign(payload);
    const redirect = `${path}?h=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirect, ttlSec }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
