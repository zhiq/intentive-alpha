// Rate-limiting hook. The alpha ships an in-memory fixed-window limiter that is
// good enough for local/dev and provides the seam to swap in Redis/Upstash for
// production. Call `checkRateLimit(key)` at the top of sensitive server actions
// (intent creation, activation, offer accept) before doing work.
//
// TODO(prod): replace the in-memory map with a shared store so limits hold
// across instances, and wire a Next.js middleware for IP-level limiting.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: RateLimitOptions = {},
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test/maintenance helper. */
export function __resetRateLimits(): void {
  buckets.clear();
}
