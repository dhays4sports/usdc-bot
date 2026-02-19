// web/lib/handoff.ts
import crypto from "crypto";
import { kv } from "@vercel/kv";

type HandoffPayload = {
  v: 1;
  iat: number;
  exp: number;
  nonce: string;
  iss: "hub.chat";
  aud: string; // "payments.chat" | "invoice.chat" | "refund.chat"
  intent: string;
  fields: Record<string, any>;
};

function b64urlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlEncodeJson(obj: any) {
  return b64urlEncode(Buffer.from(JSON.stringify(obj), "utf8"));
}

function b64urlDecodeToString(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  // pad
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

function hmac(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function safeEq(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function mintHandoffToken(opts: {
  aud: "payments.chat" | "invoice.chat" | "refund.chat";
  intent: string;
  fields: Record<string, any>;
  ttlSec?: number; // default 120
}) {
  const secret = process.env.HANDOFF_SECRET?.trim();
  if (!secret) throw new Error("Missing HANDOFF_SECRET");

  const now = Math.floor(Date.now() / 1000);
  const ttlSec = Math.max(30, Math.min(10 * 60, opts.ttlSec ?? 120)); // clamp 30s..10m

  const payload: HandoffPayload = {
    v: 1,
    iat: now,
    exp: now + ttlSec,
    nonce: crypto.randomBytes(16).toString("hex"), // 32 chars
    iss: "hub.chat",
    aud: opts.aud,
    intent: opts.intent,
    fields: opts.fields ?? {},
  };

  const p64 = b64urlEncodeJson(payload);
  const sig = b64urlEncode(hmac(secret, p64));
  return `v1.${p64}.${sig}`;
}

export async function consumeHandoffToken(opts: {
  token: string;
  expectedAud: "payments.chat" | "invoice.chat" | "refund.chat";
}) {
  const secret = process.env.HANDOFF_SECRET?.trim();
  if (!secret) throw new Error("Missing HANDOFF_SECRET");

  const parts = String(opts.token || "").split(".");
  if (parts.length !== 3) return { ok: false as const, error: "Invalid token format" };
  const [v, p64, sig] = parts;
  if (v !== "v1") return { ok: false as const, error: "Unsupported token version" };

  const expectedSig = b64urlEncode(hmac(secret, p64));
  if (!safeEq(sig, expectedSig)) return { ok: false as const, error: "Bad signature" };

  let payload: HandoffPayload;
  try {
    payload = JSON.parse(b64urlDecodeToString(p64));
  } catch {
    return { ok: false as const, error: "Bad payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.v !== 1) return { ok: false as const, error: "Bad payload version" };
  if (payload.exp <= now) return { ok: false as const, error: "Token expired" };
  if (payload.aud !== opts.expectedAud) return { ok: false as const, error: "Wrong audience" };
  if (!payload.nonce || payload.nonce.length < 16) return { ok: false as const, error: "Missing nonce" };

  // replay protection (best-effort but strong)
  const ttl = Math.max(1, payload.exp - now);
  const nonceKey = `handoff:nonce:${payload.nonce}`;

  // Vercel KV supports options object for set in newer clients.
  // If your kv client doesn't support { nx, ex }, fallback below.
  try {
    const ok = await kv.set(nonceKey, "1", { nx: true, ex: ttl } as any);
    // Some clients return "OK", some return null/boolean; handle both:
    if (ok === null || ok === false) {
      return { ok: false as const, error: "Token already used" };
    }
  } catch {
    // Fallback approach: simple get + set (weaker race protection)
    const existing = await kv.get(nonceKey);
    if (existing) return { ok: false as const, error: "Token already used" };
    await kv.set(nonceKey, "1");
    await kv.expire(nonceKey, ttl);
  }

  return {
    ok: true as const,
    payload,
  };
}
