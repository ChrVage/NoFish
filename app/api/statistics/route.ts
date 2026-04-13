import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db/index';
import { ensureTable } from '@/lib/db/lookups';

export const revalidate = 300; // ISR: regenerate at most every 5 minutes

export async function GET() {
  try {
    const sql = getSql();
    await ensureTable();

    const [totalRow, weeklyRows, kpiRow, cityRows] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total FROM lookups`,

      sql`
        SELECT date_trunc('week', created_at)::date AS week_start,
               COUNT(*)::int AS count
        FROM lookups
        WHERE created_at >= date_trunc('week', NOW()) - INTERVAL '11 weeks'
        GROUP BY date_trunc('week', created_at)::date
        ORDER BY week_start
      `,

      sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days'
                             AND created_at < NOW() - INTERVAL '7 days')::int AS prev7
        FROM lookups
        WHERE created_at >= NOW() - INTERVAL '14 days'
      `,

      sql`
        SELECT geo_city AS city, COUNT(*)::int AS count
        FROM lookups
        WHERE geo_city IS NOT NULL AND geo_city != ''
        GROUP BY geo_city
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const kpi = kpiRow[0] ?? { today: 0, last7: 0, prev7: 0 };
    return NextResponse.json(
      {
        total: totalRow[0]?.total ?? 0,
        todayCount: kpi.today ?? 0,
        last7: kpi.last7 ?? 0,
        prev7: kpi.prev7 ?? 0,
        weekly: weeklyRows.map((r: Record<string, unknown>) => ({
          week_start: r.week_start,
          count: r.count,
        })),
        topCities: cityRows.map((r: Record<string, unknown>) => ({
          city: r.city,
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
