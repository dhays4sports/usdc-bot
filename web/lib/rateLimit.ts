import { kv } from "@vercel/kv";

type RateLimitResult =
  | { ok: true; remaining?: number }
  | { ok: false; retryAfterSec: number };

function firstIpFromXForwardedFor(v: string) {
  // "1.2.3.4, 5.6.7.8" -> "1.2.3.4"
  return v.split(",")[0]?.trim();
}

export function getClientIp(req: Request): string {
  const h = req.headers;

  const xff = h.get("x-forwarded-for");
  if (xff) return firstIpFromXForwardedFor(xff) || "unknown";

  const xri = h.get("x-real-ip");
  if (xri) return xri.trim() || "unknown";

  // Vercel sometimes exposes this
  const xvercel = h.get("x-vercel-forwarded-for");
  if (xvercel) return firstIpFromXForwardedFor(xvercel) || "unknown";

  return "unknown";
}

/**
 * Simple fixed-window limiter using Redis INCR + EXPIRE.
 * - If the key doesn't exist, count becomes 1 and we set TTL.
 * - If count > limit, block.
 */
export async function rateLimit(opts: {
  surface: "remit" | "authorize";
  action: "create" | "link_proof" | "replace_proof" | "revoke";
  req: Request;
  limit: number; // max requests per window
  windowSec: number; // window size
}): Promise<RateLimitResult> {
  const ip = getClientIp(opts.req);

  // ✅ Namespace by surface + action so authorize/remit do NOT collide.
  const key = `rl:${opts.surface}:${opts.action}:${ip}`;

  const count = await kv.incr(key);

  // ✅ Ensure TTL exists (only on first hit).
  if (count === 1) {
    await kv.expire(key, opts.windowSec);
  }

  if (count > opts.limit) {
    // Best-effort TTL lookup for Retry-After
    const ttl = await kv.ttl(key).catch(() => -1);
    return { ok: false, retryAfterSec: ttl > 0 ? ttl : opts.windowSec };
  }

  return { ok: true, remaining: Math.max(0, opts.limit - count) };
}
