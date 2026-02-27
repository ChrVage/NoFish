/**
 * Simple database-backed cache for external API responses.
 *
 * Stored in the `forecast_cache` table in Neon.
 * The table is created automatically on first write (idempotent).
 *
 * Only active when DATABASE_URL is set (i.e. in production).
 * All functions swallow errors silently so a cache miss never breaks the app.
 */

import { getSql } from './index';

// DDL guard — fires once per process, not on every cache write
let _cacheTableInit: Promise<void> | null = null;

function ensureCacheTable(): Promise<void> {
  if (!_cacheTableInit) {
    const sql = getSql();
    _cacheTableInit = sql`
      CREATE TABLE IF NOT EXISTS forecast_cache (
        cache_key  TEXT PRIMARY KEY,
        data       JSONB NOT NULL,
        cached_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      )
    `.then(() => undefined).catch((err) => {
      _cacheTableInit = null; // allow retry on transient failure
      return Promise.reject(err);
    });
  }
  return _cacheTableInit;
}

// In-flight deduplication map — keyed by cache key
// Prevents concurrent requests from all firing the same expensive external fetch
// when the cache is cold. Promise is removed once settled.
const _inflight = new Map<string, Promise<unknown>>();

/**
 * Deduplicate concurrent fetches for the same `key`.
 * If a fetch is already in-flight, returns the existing Promise instead of
 * starting a new one. The entry is removed from the map when the promise settles.
 */
export function withInflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => _inflight.delete(key));
  _inflight.set(key, p);
  return p;
}

/**
 * Return cached data for `key` if it exists and has not expired, otherwise null.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT data FROM forecast_cache
      WHERE cache_key = ${key} AND expires_at > NOW()
    `;
    if (rows.length > 0) {
      return rows[0].data as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Store `data` in the cache under `key`, expiring after `ttlHours` hours.
 * Upserts on conflict so re-fetched data always refreshes the TTL.
 */
export async function setCached(
  key: string,
  data: unknown,
  ttlHours: number
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureCacheTable();
    const sql = getSql();
    await sql`
      INSERT INTO forecast_cache (cache_key, data, expires_at)
      VALUES (
        ${key},
        ${JSON.stringify(data)},
        NOW() + (${ttlHours} * interval '1 hour')
      )
      ON CONFLICT (cache_key) DO UPDATE
        SET data       = EXCLUDED.data,
            cached_at  = NOW(),
            expires_at = EXCLUDED.expires_at
    `;
  } catch (err) {
    console.warn('Cache write failed:', err);
  }
}
