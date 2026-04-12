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

interface DailyRow { day: string; count: number }
interface NameCount { name: string; count: number }
interface CountryCount { country: string; count: number }

async function getStatistics() {
  const sql = getSql();
  await ensureTable();

  const [totalRow, dailyRows, municipalityRows, countryRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS total FROM lookups`,

    sql`
      SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM lookups
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY created_at::date
    `,

    sql`
      SELECT municipality AS name, COUNT(*)::int AS count
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

  return {
    total: (totalRow[0]?.total as number) ?? 0,
    daily: dailyRows as unknown as DailyRow[],
    topMunicipalities: municipalityRows as unknown as NameCount[],
    topCountries: countryRows as unknown as CountryCount[],
  };
}

const COUNTRY_NAMES: Record<string, string> = {
  NO: 'Norway', SE: 'Sweden', DK: 'Denmark', FI: 'Finland', DE: 'Germany',
  GB: 'United Kingdom', US: 'United States', NL: 'Netherlands', PL: 'Poland',
  FR: 'France', IS: 'Iceland', ES: 'Spain', IT: 'Italy', CA: 'Canada',
  RU: 'Russia', PT: 'Portugal', IE: 'Ireland', BE: 'Belgium', AT: 'Austria',
  CH: 'Switzerland', CZ: 'Czechia', LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia',
};

export default async function StatisticsPage() {
  const stats = await getStatistics();
  const maxDaily = Math.max(...stats.daily.map((d) => d.count), 1);
  const todayCount = stats.daily.length > 0 ? stats.daily[stats.daily.length - 1].count : 0;
  const last7 = stats.daily.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = stats.daily.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  const weekTrend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

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
            <p className="text-3xl sm:text-4xl font-extrabold text-ocean-700 tabular-nums">{todayCount.toLocaleString()}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider">Today</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-center">
            <p className="text-3xl sm:text-4xl font-extrabold text-ocean-700 tabular-nums">{last7.toLocaleString()}</p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-1 uppercase tracking-wider">Last 7 days</p>
            {weekTrend !== null && (
              <p className={`text-[11px] font-medium mt-1 ${weekTrend >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                {weekTrend >= 0 ? '↑' : '↓'} {Math.abs(weekTrend)}% vs prior week
              </p>
            )}
          </div>
        </section>

        {/* ─── Daily bar chart ─── */}
        {stats.daily.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Last 30 days</h2>
            <div className="overflow-x-auto -mx-1">
              <div className="flex items-end gap-[2px] sm:gap-1" style={{ minWidth: `${stats.daily.length * 14}px`, height: '140px' }}>
                {stats.daily.map((d, i) => {
                  const pct = Math.max((d.count / maxDaily) * 100, 3);
                  const date = new Date(d.day + 'T00:00:00');
                  const dayLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = i === stats.daily.length - 1;
                  return (
                    <div
                      key={d.day}
                      className="flex-1 min-w-[8px] max-w-[24px]"
                      style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                    >
                      <div
                        className={`rounded-t-sm transition-colors ${
                          isToday ? 'bg-ocean-700' : isWeekend ? 'bg-ocean-300 hover:bg-ocean-500' : 'bg-ocean-400 hover:bg-ocean-600'
                        }`}
                        style={{ height: `${pct}%`, minHeight: '3px' }}
                        title={`${dayLabel}: ${d.count} lookups`}
                        role="img"
                        aria-label={`${dayLabel}: ${d.count} lookups`}
                      />
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels */}
              <div className="flex justify-between mt-3 text-[10px] text-gray-400 font-medium">
                <span>{new Date(stats.daily[0].day + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                {stats.daily.length >= 14 && (
                  <span>{new Date(stats.daily[Math.floor(stats.daily.length / 2)].day + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                )}
                <span>{new Date(stats.daily[stats.daily.length - 1].day + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          </section>
        )}

        {/* ─── Top lists ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Top municipalities */}
          {stats.topMunicipalities.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 pt-5 pb-3">Top municipalities</h2>
              <div className="divide-y divide-gray-50">
                {stats.topMunicipalities.map((m, i) => {
                  const barPct = Math.max((m.count / stats.topMunicipalities[0].count) * 100, 2);
                  return (
                    <div key={m.name} className="relative px-5 py-2.5">
                      {/* Background bar */}
                      <div
                        className="absolute inset-y-0 left-0 bg-ocean-50"
                        style={{ width: `${barPct}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <span className="text-sm text-gray-800">
                          <span className="text-gray-300 text-xs font-medium w-5 inline-block">{i + 1}.</span>{' '}
                          {m.name}
                        </span>
                        <span className="text-sm font-semibold text-ocean-700 tabular-nums ml-2">{m.count.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Top countries */}
          {stats.topCountries.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 pt-5 pb-3">Top countries</h2>
              <div className="divide-y divide-gray-50">
                {stats.topCountries.map((c, i) => {
                  const barPct = Math.max((c.count / stats.topCountries[0].count) * 100, 2);
                  return (
                    <div key={c.country} className="relative px-5 py-2.5">
                      <div
                        className="absolute inset-y-0 left-0 bg-ocean-50"
                        style={{ width: `${barPct}%` }}
                      />
                      <div className="relative flex items-center justify-between">
                        <span className="text-sm text-gray-800">
                          <span className="text-gray-300 text-xs font-medium w-5 inline-block">{i + 1}.</span>{' '}
                          {COUNTRY_NAMES[c.country] ?? c.country}
                        </span>
                        <span className="text-sm font-semibold text-ocean-700 tabular-nums ml-2">{c.count.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 pb-4">
          Aggregate data only — no personal information is displayed. Refreshed every 5 minutes.
        </p>
      </main>
    </div>
  );
}
