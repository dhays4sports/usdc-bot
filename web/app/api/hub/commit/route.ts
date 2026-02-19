// web/app/api/hub/commit/route.ts
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

type CommitBody = {
  intent?: string;

  // old shape (recommended)
  route?: { aud?: string; path?: string };

  // compatibility shape (what your hub UI was sending earlier)
  aud?: string;
  path?: string;

  fields?: Record<string, any>;
  context?: any;
};

function normalizeAud(raw: string) {
  const a = raw.trim().toLowerCase();
  if (!a) return "";
  // allow passing "payments" shorthand if you ever do
  if (a === "payments") return "payments.chat";
  if (a === "invoice") return "invoice.chat";
  if (a === "refund") return "refund.chat";
  return a;
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "hub",
    action: "commit",
    req,
    limit: 40,
    windowSec: 60,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again soon." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as CommitBody;

    const intent = String(body.intent ?? "").trim();

    // ✅ accept both shapes
    const audRaw = String(body.route?.aud ?? body.aud ?? "").trim();
    const pathRaw = String(body.route?.path ?? body.path ?? "").trim();

    const aud = normalizeAud(audRaw);
    const path = pathRaw || "/new";

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

    // ✅ IMPORTANT: absolute redirect to the target surface host
    const redirect = `https://${aud}${path}?h=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirect, ttlSec }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
