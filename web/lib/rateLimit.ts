import { kv } from "@vercel/kv";

type RateLimitResult =
  | { ok: true; remaining: number; resetSeconds: number }
  | { ok: false; retryAfterSeconds: number };

function ipFromReq(req: Request) {
  // Vercel forwards a stable client IP header in production
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * KV-backed fixed-window counter.
 * Key: rl:{scope}:{ip}
 */
export async function rateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const ip = ipFromReq(req);
  const key = `rl:${scope}:${ip}`;

  // We store a simple counter with expiry.
  const current = (await kv.get<number>(key)) ?? 0;

  if (current >= limit) {
    return { ok: false, retryAfterSeconds: windowSeconds };
  }

  // increment and ensure expiry
  const next = current + 1;

  // If this is the first hit in the window, set with expiry.
  if (current === 0) {
    // setex-style: set then expire
    await kv.set(key, next, { ex: windowSeconds });
  } else {
    // normal set (TTL continues)
    await kv.set(key, next);
  }

  return { ok: true, remaining: Math.max(0, limit - next), resetSeconds: windowSeconds };
}
