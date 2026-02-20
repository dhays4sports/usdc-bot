// web/lib/rateLimit.ts
import { kv } from "@vercel/kv";

type RateLimitResult =
  | { ok: true; remaining?: number }
  | { ok: false; retryAfterSec: number };

// ✅ Single source of truth
// Add the surfaces you’re actively using.
const SURFACES = ["remit", "authorize", "payments", "invoice", "refund", "hub", "sms"] as const;
export type Surface = (typeof SURFACES)[number];

// ✅ Actions: include preview/commit/accept for hub handoffs.
// Add inbound for SMS webhooks.
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
  // "1.2.3.4, 5.6.7.8" -> "1.2.3.4"
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
 * Simple fixed-window limiter using Redis INCR + EXPIRE.
 * - If the key doesn't exist, count becomes 1 and we set TTL.
 * - If count > limit, block.
 *
 * ✅ Supports an optional `key` override (ex: phone number) so SMS is not IP-based.
 */
export async function rateLimit(opts: {
  surface: Surface;
  action: Action;
  req: Request;
  key?: string; // OPTIONAL override (ex: "+1669...")
  limit: number; // max requests per window
  windowSec: number; // window size
}): Promise<RateLimitResult> {
  const identity = (opts.key && String(opts.key).trim()) || getClientIp(opts.req);

  // ✅ Namespace by surface + action so hubs/surfaces do NOT collide.
  const k = `rl:${opts.surface}:${opts.action}:${identity}`;

  const count = await kv.incr(k);

  // ✅ Ensure TTL exists (only on first hit).
  if (count === 1) {
    await kv.expire(k, opts.windowSec);
  }

  if (count > opts.limit) {
    const ttl = await kv.ttl(k).catch(() => -1);
    return { ok: false, retryAfterSec: ttl > 0 ? ttl : opts.windowSec };
  }

  return { ok: true, remaining: Math.max(0, opts.limit - count) };
}
