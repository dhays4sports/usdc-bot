// web/app/api/hub/commit/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const SECRET = process.env.HUB_HANDOFF_SECRET?.trim() || "";

// ✅ Only allow routing to known surfaces
const ALLOWED_AUD = new Set(["payments.chat", "invoice.chat", "refund.chat"] as const);

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
  intent?: string;

  // ✅ support BOTH styles:
  // new UI: { aud, path }
  aud?: string;
  path?: string;

  // older spec: { route: { aud, path } }
  // newer preview naming: { route: { surface, path } }
  route?: { aud?: string; surface?: string; path?: string };

  fields?: Record<string, any>;
  context?: any;
};

function isSafePath(p: string) {
  // Must be a relative path like "/new" (not "https://...", not "//evil.com")
  return p.startsWith("/") && !p.startsWith("//") && !p.includes("://");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as CommitBody;

    const intent = String(body.intent ?? "").trim();

    // ✅ Accept aud from: body.aud OR body.route.aud OR body.route.surface
    const aud = String(body.aud ?? body.route?.aud ?? body.route?.surface ?? "").trim().toLowerCase();

    // ✅ Accept path from: body.path OR body.route.path
    const path = String(body.path ?? body.route?.path ?? "").trim();

    if (!intent) return NextResponse.json({ error: "Missing intent" }, { status: 400 });
    if (!aud) return NextResponse.json({ error: "Missing route.aud" }, { status: 400 });

    if (!ALLOWED_AUD.has(aud as any)) {
      return NextResponse.json({ error: "Invalid route.aud" }, { status: 400 });
    }

    if (!path || !isSafePath(path)) {
      return NextResponse.json({ error: "route.path must be a safe relative path starting with /" }, { status: 400 });
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

    // ✅ IMPORTANT: Redirect to the target SURFACE, not a relative path on hub.chat
    const redirect = `https://${aud}${path}?h=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirect, ttlSec }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
