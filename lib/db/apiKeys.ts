/**
 * API key management for public v1 API
 * Keys are stored in Neon Postgres, used for registration + rate limiting
 */

import { getSql } from './index';
import { randomBytes } from 'crypto';

let _tableInit: Promise<void> | null = null;

export interface ApiKeyRecord {
  key: string;
  email: string;
  createdAt: Date;
  lastUsedAt?: Date;
  requestsToday?: number;
  requestsThisMinute?: number;
}

/**
 * Generate a cryptographically secure API key (32 bytes = 64 hex chars)
 */
export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Ensure the api_keys table exists (idempotent).
 * Memoized: fires only once per process lifetime.
 */
export function ensureTable(): Promise<void> {
  if (_tableInit) {return _tableInit;}
  const sql = getSql();
  _tableInit = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        key            TEXT PRIMARY KEY,
        email          TEXT NOT NULL UNIQUE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at   TIMESTAMPTZ,
        requests_today INTEGER NOT NULL DEFAULT 0,
        last_reset_day DATE NOT NULL DEFAULT CURRENT_DATE
      )
    `;
    // Create index for lookups by email (for duplicate prevention)
    await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(email)`;
  })().catch((err) => {
    _tableInit = null; // allow retry on transient failure
    return Promise.reject(err);
  });
  return _tableInit;
}

/**
 * Register a new API key for an email address.
 * Returns the generated key if successful, or null if email already registered.
 */
export async function registerApiKey(email: string): Promise<string | null> {
  const sql = getSql();
  await ensureTable();

  try {
    const key = generateApiKey();
    await sql`
      INSERT INTO api_keys (key, email)
      VALUES (${key}, ${email.toLowerCase()})
      ON CONFLICT (email) DO NOTHING
    `;

    // Check if insert was successful by trying to fetch it back
    const result = await sql`
      SELECT key FROM api_keys WHERE email = ${email.toLowerCase()} LIMIT 1
    `;

    if (result.length > 0) {
      return result[0].key;
    }
    return null; // Email already registered
  } catch (error) {
    console.error('Error registering API key:', error);
    throw error;
  }
}

/**
 * Validate an API key and return its record (null if invalid/expired)
 */
export async function validateApiKey(key: string): Promise<ApiKeyRecord | null> {
  const sql = getSql();
  await ensureTable();

  try {
    const result = await sql`
      SELECT key, email, created_at, last_used_at, requests_today, last_reset_day
      FROM api_keys
      WHERE key = ${key}
      LIMIT 1
    `;

    if (result.length === 0) {return null;}

    const row = result[0];

    // Reset daily counter if a new day has started
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastResetDay = row.last_reset_day.toISOString().split('T')[0];

    if (today !== lastResetDay) {
      await sql`
        UPDATE api_keys
        SET requests_today = 0, last_reset_day = ${today}::date
        WHERE key = ${key}
      `;
    }

    return {
      key: row.key,
      email: row.email,
      createdAt: new Date(row.created_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      requestsToday: row.requests_today,
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    throw error;
  }
}

/**
 * Increment request counter for an API key (called after each successful request)
 */
export async function incrementKeyRequestCount(key: string): Promise<void> {
  const sql = getSql();

  try {
    await sql`
      UPDATE api_keys
      SET requests_today = requests_today + 1,
          last_used_at = NOW()
      WHERE key = ${key}
    `;
  } catch (error) {
    console.error('Error incrementing request count:', error);
    throw error;
  }
}

/**
 * Get request count for a key (for rate limit checking)
 */
export async function getKeyRequestCount(key: string): Promise<{ today: number; inLastMinute: number }> {
  const sql = getSql();
  await ensureTable();

  try {
    const result = await sql`
      SELECT requests_today FROM api_keys
      WHERE key = ${key}
      LIMIT 1
    `;

    if (result.length === 0) {
      return { today: 0, inLastMinute: 0 };
    }

    // Note: in-memory per-key rate limiting is handled in rateLimit.ts
    return {
      today: result[0].requests_today,
      inLastMinute: 0, // tracked in-memory
    };
  } catch (error) {
    console.error('Error getting request count:', error);
    throw error;
  }
}
