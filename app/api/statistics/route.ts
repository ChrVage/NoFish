import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/index';
import { ensureTable } from '@/lib/db/lookups';

export const revalidate = 300; // ISR: regenerate at most every 5 minutes

export async function GET() {
  try {
    const sql = getSql();
    await ensureTable();

    const [totalRow, dailyRows, municipalityRows, countryRows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM lookups`,

      sql`
        SELECT created_at::date AS day, COUNT(*)::int AS count
        FROM lookups
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day
        ORDER BY day
      `,

      sql`
        SELECT municipality, COUNT(*)::int AS count
        FROM lookups
        WHERE municipality IS NOT NULL AND municipality != '' AND municipality != 'Unknown municipality'
        GROUP BY municipality
        ORDER BY count DESC
        LIMIT 10
      `,

      sql`
        SELECT geo_country AS country, COUNT(*)::int AS count
        FROM lookups
        WHERE geo_country IS NOT NULL AND geo_country != ''
        GROUP BY geo_country
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    return NextResponse.json(
      {
        total: totalRow[0]?.total ?? 0,
        daily: dailyRows.map((r: Record<string, unknown>) => ({
          day: r.day,
          count: r.count,
        })),
        topMunicipalities: municipalityRows.map((r: Record<string, unknown>) => ({
          name: r.municipality,
          count: r.count,
        })),
        topCountries: countryRows.map((r: Record<string, unknown>) => ({
          country: r.country,
          count: r.count,
        })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('Statistics API error:', error);
    return NextResponse.json(
      { error: 'Failed to load statistics' },
      { status: 500 },
    );
  }
}
