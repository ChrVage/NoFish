import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight in-memory sliding-window rate limiter.
 * Each instance tracks a single route/purpose.
 * Not shared across Vercel serverless instances — provides per-instance protection
 * against burst abuse while remaining zero-dependency.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, WindowEntry>>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function getStore(name: string): Map<string, WindowEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

function ensureCleanup() {
  if (cleanupTimer) {return;}
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const store of stores.values()) {
      for (const [key, entry] of store) {
        if (now > entry.resetAt) {store.delete(key);}
      }
    }
  }, 60_000);
  // Allow the Node process to exit even if the timer is still active
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitConfig {
  /** Unique name for this limiter (e.g. 'weather', 'search') */
  name: string;
  /** Maximum requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

/**
 * Returns null if the request is allowed, or a 429 NextResponse if rate-limited.
 */
export function checkRateLimit(request: NextRequest, config: RateLimitConfig): NextResponse | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  const store = getStore(config.name);
  const now = Date.now();

  ensureCleanup();

  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  return null;
}

/**
 * Per-API-key rate limiting with daily and per-minute windows.
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 *
 * @param apiKey The API key to rate limit
 * @param dailyLimit Maximum requests per calendar day
 * @param minuteLimit Maximum requests per minute
 * @param requestsToday Current count of requests used today (from database)
 */
export interface PerKeyRateLimitConfig {
  dailyLimit: number;
  minuteLimit: number;
}

interface PerKeyStore {
  minuteCounts: Map<string, WindowEntry>;
}

const perKeyStores = new Map<string, PerKeyStore>();

/**
 * Rate limit a request by API key with daily + per-minute windows.
 * Daily limit is checked against database count; minute limit is in-memory.
 */
export function checkApiKeyRateLimit(
  apiKey: string,
  config: PerKeyRateLimitConfig,
  requestsToday: number
): NextResponse | null {
  const now = Date.now();
  const storeName = `api:${apiKey}`;

  ensureCleanup();

  // Check daily limit (tracked in database)
  if (requestsToday > config.dailyLimit) {
    const retryAfter = 86400; // Retry tomorrow
    return NextResponse.json(
      { success: false, error: 'Daily API request limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit-Day': String(config.dailyLimit),
          'X-RateLimit-Used-Day': String(requestsToday),
          'X-RateLimit-Reset-Day': new Date(Date.now() + retryAfter * 1000).toISOString(),
        },
      }
    );
  }

  // Check per-minute limit (in-memory)
  let store = perKeyStores.get(storeName);
  if (!store) {
    store = { minuteCounts: new Map() };
    perKeyStores.set(storeName, store);
  }

  const minuteKey = `${storeName}:minute`;
  let minuteEntry = store.minuteCounts.get(minuteKey);

  if (!minuteEntry || now > minuteEntry.resetAt) {
    store.minuteCounts.set(minuteKey, { count: 1, resetAt: now + 60 * 1000 });
    return null;
  }

  minuteEntry.count++;

  if (minuteEntry.count > config.minuteLimit) {
    const retryAfter = Math.ceil((minuteEntry.resetAt - now) / 1000);
    return NextResponse.json(
      { success: false, error: 'Per-minute API request limit exceeded' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit-Minute': String(config.minuteLimit),
          'X-RateLimit-Used-Minute': String(minuteEntry.count),
          'X-RateLimit-Reset-Minute': new Date(minuteEntry.resetAt).toISOString(),
        },
      }
    );
  }

  return null;
}
