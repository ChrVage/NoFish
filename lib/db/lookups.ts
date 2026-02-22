import { sql } from './index';

export interface LookupRecord {
  lat: number;
  lon: number;
  locationName?: string;
  municipality?: string;
  county?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Ensure the lookups table exists (idempotent — safe to call on every cold start).
 * Run this once manually in the Neon SQL editor instead if you prefer explicit migrations.
 */
export async function ensureTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS lookups (
      id          SERIAL PRIMARY KEY,
      lat         DOUBLE PRECISION NOT NULL,
      lon         DOUBLE PRECISION NOT NULL,
      location_name TEXT,
      municipality  TEXT,
      county        TEXT,
      ip_address    TEXT,
      user_agent    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function insertLookup(record: LookupRecord): Promise<void> {
  await sql`
    INSERT INTO lookups (lat, lon, location_name, municipality, county, ip_address, user_agent)
    VALUES (
      ${record.lat},
      ${record.lon},
      ${record.locationName ?? null},
      ${record.municipality ?? null},
      ${record.county ?? null},
      ${record.ipAddress ?? null},
      ${record.userAgent ?? null}
    )
  `;
}
