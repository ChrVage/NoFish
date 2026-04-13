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
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
      <Header>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <BackButton />
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Usage Statistics</h1>
          <div className="w-[72px]" />
        </div>
      </Header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* ─── KPI cards ─── */}
        <section className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { value: stats.total, label: 'Total lookups', accent: false },
            { value: stats.last7, label: 'Last 7 days', accent: true },
            { value: stats.todayCount, label: 'Today', accent: false },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl p-5 sm:p-6 text-center transition-shadow hover:shadow-md"
              style={{
                background: card.accent
                  ? 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)'
                  : '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <p
                className="text-3xl sm:text-4xl font-extrabold tabular-nums"
                style={{ color: card.accent ? '#ffffff' : '#0369a1' }}
              >
                {card.value.toLocaleString()}
              </p>
              <p
                className="text-[11px] sm:text-xs mt-1.5 uppercase tracking-widest font-semibold"
                style={{ color: card.accent ? 'rgba(255,255,255,0.75)' : '#94a3b8' }}
              >
                {card.label}
              </p>
              {card.label === 'Last 7 days' && weekTrend !== null && (
                <p
                  className="text-xs font-semibold mt-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: weekTrend >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                  }}
                >
                  {weekTrend >= 0 ? '↑' : '↓'} {Math.abs(weekTrend)}%
                </p>
              )}
            </div>
          ))}
        </section>

        {/* ─── Weekly bar chart ─── */}
        {stats.weekly.length > 0 && (
          <section
            className="rounded-2xl p-5 sm:p-7"
            style={{
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <h2 className="text-sm font-bold text-gray-700 tracking-tight mb-5">Visitors per week</h2>
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1 sm:gap-2" style={{ minWidth: `${stats.weekly.length * 52}px` }}>
                {stats.weekly.map((w, i) => {
                  const pct = Math.max((w.count / maxWeekly) * 100, 4);
                  const barH = Math.round((pct / 100) * 130);
                  const weekDate = new Date(w.week_start + 'T00:00:00');
                  const weekLabel = weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  const isCurrentWeek = i === stats.weekly.length - 1;
                  return (
                    <div
                      key={w.week_start}
                      className="flex-1 flex flex-col items-center group"
                      style={{ minWidth: '38px' }}
                    >
                      <span
                        className="text-[10px] font-bold tabular-nums mb-1 transition-colors"
                        style={{ color: isCurrentWeek ? '#0369a1' : '#94a3b8' }}
                      >
                        {w.count}
                      </span>
                      <div
                        className="w-full transition-all group-hover:opacity-80"
                        style={{
                          height: `${barH}px`,
                          borderRadius: '6px 6px 2px 2px',
                          background: isCurrentWeek
                            ? 'linear-gradient(180deg, #0369a1 0%, #0c4a6e 100%)'
                            : 'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)',
                        }}
                        title={`Week of ${weekLabel}: ${w.count} lookups`}
                        role="img"
                        aria-label={`Week of ${weekLabel}: ${w.count} lookups`}
                      />
                      <span
                        className="text-[9px] font-semibold mt-2 whitespace-nowrap"
                        style={{ color: isCurrentWeek ? '#0369a1' : '#b0b8c4' }}
                      >
                        {weekLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <p className="text-center text-[11px] text-gray-400 pb-6 tracking-wide">
          Aggregate data only — no personal information is displayed. Refreshed every 5 min.
        </p>
      </main>
    </div>
  );
}
