import { getSql } from '@/lib/db/index';
import { ensureTable } from '@/lib/db/lookups';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'NoFish — Usage Statistics',
  description: 'Aggregate usage statistics for NoFish.no',
};

interface WeeklyRow { week_start: string; count: number }
interface CityCount { city: string; count: number }

async function getStatistics() {
  const sql = getSql();
  await ensureTable();

  const [totalRow, weeklyRows, kpiRow, cityRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM lookups`,

    sql`
      SELECT to_char(date_trunc('week', created_at)::date, 'YYYY-MM-DD') AS week_start,
             COUNT(*)::int AS count
      FROM lookups
      WHERE created_at >= date_trunc('week', NOW()) - INTERVAL '12 weeks'
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
  return {
    total: (totalRow[0]?.total as number) ?? 0,
    weekly: weeklyRows as unknown as WeeklyRow[],
    todayCount: (kpi.today as number) ?? 0,
    last7: (kpi.last7 as number) ?? 0,
    prev7: (kpi.prev7 as number) ?? 0,
    topCities: cityRows as unknown as CityCount[],
  };
}

export default async function StatisticsPage() {
  const stats = await getStatistics();
  const maxWeekly = Math.max(...stats.weekly.map((w) => w.count), 1);
  const weekTrend = stats.prev7 > 0 ? Math.round(((stats.last7 - stats.prev7) / stats.prev7) * 100) : null;

  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <BackButton />
          <h1 className="text-base font-semibold text-gray-800">Usage Statistics</h1>
          <div className="w-[72px]" />
        </div>
      </Header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* ─── KPI cards ─── */}
        <section className="grid grid-cols-3 gap-3 sm:gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-ocean-700 tabular-nums">{stats.total.toLocaleString()}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider">Total lookups</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-ocean-700 tabular-nums">{stats.last7.toLocaleString()}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider">Last 7 days</p>
            {weekTrend !== null && (
              <p className={`text-[11px] font-medium mt-1 ${weekTrend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {weekTrend >= 0 ? '↑' : '↓'} {Math.abs(weekTrend)}% vs prior week
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-ocean-700 tabular-nums">{stats.todayCount.toLocaleString()}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider">Today</p>
          </div>
        </section>

        {/* ─── Weekly bar chart ─── */}
        {stats.weekly.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Visitors per week</h2>
            <div className="overflow-x-auto -mx-1">
              <div className="flex items-end gap-1 sm:gap-2" style={{ minWidth: `${stats.weekly.length * 56}px` }}>
                {stats.weekly.map((w, i) => {
                  const pct = Math.max((w.count / maxWeekly) * 100, 3);
                  const barH = Math.round((pct / 100) * 120);
                  const weekDate = new Date(w.week_start + 'T00:00:00');
                  const weekLabel = weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  const isCurrentWeek = i === stats.weekly.length - 1;
                  return (
                    <div
                      key={w.week_start}
                      className="flex-1 flex flex-col items-center"
                      style={{ minWidth: '40px' }}
                    >
                      <span className="text-[10px] text-gray-400 font-medium tabular-nums mb-1">{w.count}</span>
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${barH}px`,
                          backgroundColor: isCurrentWeek ? '#0369a1' : '#0ea5e9',
                        }}
                        title={`Week of ${weekLabel}: ${w.count} lookups`}
                        role="img"
                        aria-label={`Week of ${weekLabel}: ${w.count} lookups`}
                      />
                      <span className="text-[9px] text-gray-400 font-medium mt-1 whitespace-nowrap">{weekLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <p className="text-center text-[11px] text-gray-400 pb-4">
          Aggregate data only — no personal information is displayed. Refreshed every 5 minutes.
        </p>
      </main>
    </div>
  );
}
