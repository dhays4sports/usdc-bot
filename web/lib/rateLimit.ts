// web/lib/rateLimit.ts
import { kv } from "@vercel/kv";

type RateLimitResult =
  | { ok: true; remaining?: number }
  | { ok: false; retryAfterSec: number };

// ✅ Add "sms"
const SURFACES = ["remit", "authorize", "payments", "invoice", "refund", "hub", "sms"] as const;
export type Surface = (typeof SURFACES)[number];

// ✅ Add "inbound"
const ACTIONS = [
  "create",
  "preview",
  "commit",
  "accept",
  "link_proof",
  "replace_proof",
  "revoke",
  "inbound",
] as const;
export type Action = (typeof ACTIONS)[number];

function firstIpFromXForwardedFor(v: string) {
  return v.split(",")[0]?.trim();
}

export function getClientIp(req: Request): string {
  const h = req.headers;

  const xff = h.get("x-forwarded-for");
  if (xff) return firstIpFromXForwardedFor(xff) || "unknown";

  const xri = h.get("x-real-ip");
  if (xri) return xri.trim() || "unknown";

  const xvercel = h.get("x-vercel-forwarded-for");
  if (xvercel) return firstIpFromXForwardedFor(xvercel) || "unknown";

  return "unknown";
}

/**
 * Fixed-window limiter using Redis INCR + EXPIRE.
 * - Namespaced by surface + action
 * - Can optionally use a custom key (e.g., phone number) instead of IP
 */
export async function rateLimit(opts: {
  surface: Surface;
  action: Action;
  req: Request;
  limit: number;
  windowSec: number;
  key?: string; // ✅ OPTIONAL override (phone, user id, etc)
}): Promise<RateLimitResult> {
  const ip = getClientIp(opts.req);
  const ident = String(opts.key ?? ip ?? "unknown");

  // ✅ Namespace by surface + action so hubs/surfaces do NOT collide.
  const key = `rl:${opts.surface}:${opts.action}:${ident}`;

  const count = await kv.incr(key);

  if (count === 1) {
    await kv.expire(key, opts.windowSec);
  }

  if (count > opts.limit) {
    const ttl = await kv.ttl(key).catch(() => -1);
    return { ok: false, retryAfterSec: ttl > 0 ? ttl : opts.windowSec };
  }

  return { ok: true, remaining: Math.max(0, opts.limit - count) };
}
