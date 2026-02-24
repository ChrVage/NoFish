import { getSql } from './index';

export interface LookupRecord {
  lat: number;
  lon: number;
  locationName?: string;
  municipality?: string;
  county?: string;
  ipAddress?: string;
  userAgent?: string;
  geoCountry?: string;   // e.g. "NO"
  geoRegion?: string;    // e.g. "Oslo"
  geoCity?: string;      // e.g. "Oslo"
}

/**
 * Ensure the lookups table exists (idempotent — safe to call on every cold start).
 * Run this once manually in the Neon SQL editor instead if you prefer explicit migrations.
 */
export async function ensureTable(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS lookups (
      id            SERIAL PRIMARY KEY,
      lat           DOUBLE PRECISION NOT NULL,
      lon           DOUBLE PRECISION NOT NULL,
      location_name TEXT,
      municipality  TEXT,
      county        TEXT,
      ip_address    TEXT,
      user_agent    TEXT,
      geo_country   TEXT,
      geo_region    TEXT,
      geo_city      TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Add columns to pre-existing tables (idempotent)
  await sql`ALTER TABLE lookups ADD COLUMN IF NOT EXISTS geo_country TEXT`;
  await sql`ALTER TABLE lookups ADD COLUMN IF NOT EXISTS geo_region  TEXT`;
  await sql`ALTER TABLE lookups ADD COLUMN IF NOT EXISTS geo_city    TEXT`;
}

export async function insertLookup(record: LookupRecord): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO lookups (lat, lon, location_name, municipality, county, ip_address, user_agent, geo_country, geo_region, geo_city)
    VALUES (
      ${record.lat},
      ${record.lon},
      ${record.locationName ?? null},
      ${record.municipality ?? null},
      ${record.county ?? null},
      ${record.ipAddress ?? null},
      ${record.userAgent ?? null},
      ${record.geoCountry ?? null},
      ${record.geoRegion ?? null},
      ${record.geoCity ?? null}
    )
  `;
}
