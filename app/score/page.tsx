import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { parseZoomParam } from '@/lib/utils/params';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import { computeFishingScore, findBestWindows, getScoreColor, getScoreBg } from '@/lib/scoring/fishingScore';
import { getTimeColumnStyle } from '@/lib/utils/sunPhaseStyle';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string }>;
}

export default async function ScorePage({ searchParams }: PageProps) {
  const { lat: latStr, lng: lngStr, zoom: zoomStr, sea: seaStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const isSea = seaStr === '0' ? false : seaStr === '1' ? true : undefined;

  const [locationData, weatherResult] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng, isSea !== undefined ? { isSea } : undefined),
  ]);

  const { forecasts: rawForecasts, currentForecastLat, currentForecastLng: _currentForecastLng, currentForecastDistanceKm: _currentForecastDistanceKm } = weatherResult;
  const forecasts = enrichForecasts(rawForecasts);
  const hasOceanData = forecasts.some(f => f.waveHeight !== undefined);
  const hasCurrentData = currentForecastLat !== undefined;
  const timezone = getTimezone(lat, lng);

  // Pre-compute scores for all forecasts (depth-adaptive)
  const depth = locationData?.isSea && locationData.elevation !== undefined
    ? Math.abs(locationData.elevation)
    : undefined;
  const scoredForecasts = forecasts.map(f => ({ forecast: f, ...computeFishingScore(f, depth) }));

  // Find best fishing windows (top 2 non-overlapping, 1–3 hours)
  const bestWindows = findBestWindows(scoredForecasts);

  // Set of row indices within a best-window (for highlighting)
  const bestWindowIndices = new Set<number>();
  bestWindows.forEach(w => { for (let j = 0; j < w.len; j++) {bestWindowIndices.add(w.start + j);} });

  // Comma-separated ISO times for best-window rows (passed to details via URL)
  const highlightTimes = Array.from(bestWindowIndices)
    .map(i => scoredForecasts[i].forecast.time)
    .join(',');

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    return `${weekday}. ${day}. ${hour}:${minute}`;
  };

  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} sea={seaStr} current="score" highlightTimes={highlightTimes} />
        </div>
      </Header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                {locationData.name}
                {locationData.municipality && locationData.municipality !== 'Unknown municipality' && locationData.municipality !== locationData.name && (
                  <span className="text-lg font-normal text-gray-500">, {locationData.municipality}</span>
                )}
              </h2>
            )}
            <p className="text-sm text-gray-500">
              {Math.abs(lat).toFixed(4)}°{lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(lng).toFixed(4)}°{lng >= 0 ? 'E' : 'W'}
              {locationData?.elevation !== undefined && (
                <span className="ml-2 text-gray-400">
                  · {locationData.isSea
                    ? `Depth: ${Math.abs(Math.round(locationData.elevation))} m`
                    : `Elevation: ${Math.round(locationData.elevation)} m`}
                </span>
              )}
            </p>
            {!hasCurrentData && hasOceanData && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ No reliable current forecast — current speed not included in score
              </p>
            )}
            <h3 className="text-sm font-bold text-ocean-900 mt-3">Best fishing windows:</h3>
            {bestWindows.length > 0 ? (() => {
              const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
              const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });
              const locationName = locationData
                ? (locationData.municipality && locationData.municipality !== 'Unknown municipality' && locationData.name !== locationData.municipality
                    ? `${locationData.name}, ${locationData.municipality}`
                    : locationData.name || locationData.municipality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
                : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
              const icsDateFmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
              const gcalDateFmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z');

              const buildDescription = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) {hours.push(scoredForecasts[w.start + j]);}
                const avg = Math.round(w.avg);
                const safetyAvg = Math.round(hours.reduce((s, h) => s + h.safetyScore, 0) / hours.length);
                const fishingAvg = Math.round(hours.reduce((s, h) => s + h.fishingScore, 0) / hours.length);

                const lines: string[] = [
                  `NoFish Score: ${avg}%`,
                  `  Safety: ${safetyAvg}%  |  Fishing: ${fishingAvg}%`,
                  '',
                ];
                for (const h of hours) {
                  const f = h.forecast;
                  const t = timeFmt.format(new Date(f.time));
                  lines.push(`${t}  —  Score ${h.score}%`);
                  if (f.windSpeed !== undefined) {lines.push(`  Wind: ${f.windSpeed.toFixed(1)} m/s${f.windGust ? ` (gust ${f.windGust.toFixed(1)})` : ''}`);}
                  if (f.waveHeight !== undefined) {lines.push(`  Waves: ${f.waveHeight.toFixed(1)} m${f.wavePeriod !== undefined ? ` · ${f.wavePeriod.toFixed(1)}s period` : ''}`);}
                  if (f.currentSpeed !== undefined) {lines.push(`  Current: ${f.currentSpeed.toFixed(2)} m/s`);}
                  if (f.temperature !== undefined) {lines.push(`  Air: ${f.temperature.toFixed(1)}°C${f.seaTemperature !== undefined ? `  Sea: ${f.seaTemperature.toFixed(1)}°C` : ''}`);}
                  if (f.pressure !== undefined) {lines.push(`  Pressure: ${f.pressure.toFixed(0)} hPa`);}
                  if (f.tidePhase) {lines.push(`  Tide: ${f.tidePhase}`);}
                  if (f.moonPhase) {lines.push(`  Moon: ${f.moonPhase}`);}
                }
                lines.push('', `Location: ${mapsUrl}`);
                return lines.join('\n');
              };

              const buildIcs = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) {hours.push(scoredForecasts[w.start + j]);}
                const start = new Date(hours[0].forecast.time);
                const last = new Date(hours[hours.length - 1].forecast.time);
                const end = new Date(last.getTime() + 3600000);
                const avg = Math.round(w.avg);
                const desc = buildDescription(w).replace(/\n/g, '\\n');

                const ics = [
                  'BEGIN:VCALENDAR',
                  'VERSION:2.0',
                  'PRODID:-//NoFish//Score//EN',
                  'BEGIN:VEVENT',
                  `DTSTART:${icsDateFmt(start)}`,
                  `DTEND:${icsDateFmt(end)}`,
                  `SUMMARY:🎣 Fishing ${avg}% – ${locationName}`,
                  `DESCRIPTION:${desc}`,
                  `LOCATION:${locationName}`,
                  `GEO:${lat};${lng}`,
                  `URL:${mapsUrl}`,
                  `UID:nofish-${start.getTime()}@nofish`,
                  'END:VEVENT',
                  'END:VCALENDAR',
                ].join('\r\n');
                return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
              };

              const buildGoogleUrl = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) {hours.push(scoredForecasts[w.start + j]);}
                const start = new Date(hours[0].forecast.time);
                const last = new Date(hours[hours.length - 1].forecast.time);
                const end = new Date(last.getTime() + 3600000);
                const avg = Math.round(w.avg);
                const desc = buildDescription(w);

                const params = new URLSearchParams({
                  action: 'TEMPLATE',
                  text: `🎣 Fishing ${avg}% – ${locationName}`,
                  dates: `${gcalDateFmt(start)}/${gcalDateFmt(end)}`,
                  details: desc,
                  location: `${lat},${lng}`,
                });
                return `https://calendar.google.com/calendar/render?${params.toString()}`;
              };

              const buildOutlookUrl = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) {hours.push(scoredForecasts[w.start + j]);}
                const start = new Date(hours[0].forecast.time);
                const last = new Date(hours[hours.length - 1].forecast.time);
                const end = new Date(last.getTime() + 3600000);
                const avg = Math.round(w.avg);
                const desc = buildDescription(w);

                const params = new URLSearchParams({
                  path: '/calendar/action/compose',
                  rru: 'addevent',
                  subject: `🎣 Fishing ${avg}% – ${locationName}`,
                  startdt: start.toISOString(),
                  enddt: end.toISOString(),
                  body: desc,
                  location: locationName,
                });
                return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
              };

              return (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {bestWindows.map((w, idx) => {
                    const startDate = new Date(scoredForecasts[w.start].forecast.time);
                    const lastDate = new Date(scoredForecasts[w.start + w.len - 1].forecast.time);
                    const endHour = new Date(lastDate.getTime() + 3600000);
                    const avg = Math.round(w.avg);
                    return (
                      <div key={idx} style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '12px 16px', backgroundColor: '#f9fafb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <a
                            href={`#t-${scoredForecasts[w.start].forecast.time}`}
                            style={{
                              display: 'inline-block', minWidth: '48px', textAlign: 'center',
                              borderRadius: '6px', padding: '4px 8px', fontSize: '14px', fontWeight: 800,
                              color: getScoreColor(avg), backgroundColor: getScoreBg(avg),
                              textDecoration: 'none', cursor: 'pointer',
                            }}
                            title="Jump to this window in the table"
                          >
                            {avg}%
                          </a>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>
                            {dateFmt.format(startDate)}{' '}
                            {timeFmt.format(startDate)}–{timeFmt.format(endHour)}
                          </span>
                        </div>
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9ca3af' }}>
                          <span>Add to calendar:</span>
                          <a
                            href={buildGoogleUrl(w)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#4b5563', textDecoration: 'none', fontSize: '12px' }}
                            title="Google Calendar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24">
                              <path d="M18.316 5.684H24v12.632h-5.684V5.684z" fill="#4285F4"/>
                              <path d="M5.684 18.316H0V5.684h5.684v12.632z" fill="#34A853"/>
                              <path d="M18.316 24H5.684v-5.684h12.632V24z" fill="#188038"/>
                              <path d="M5.684 5.684V0h12.632v5.684H5.684z" fill="#FBBC04"/>
                              <path d="M18.316 5.684H24V0h-5.684v5.684z" fill="#1967D2"/>
                              <path d="M18.316 18.316H24V24h-5.684v-5.684z" fill="#1967D2"/>
                              <path d="M5.684 5.684H0V0h5.684v5.684z" fill="#EA4335"/>
                              <path d="M5.684 18.316H0V24h5.684v-5.684z" fill="#0D652D"/>
                            </svg>
                            Google
                          </a>
                          <a
                            href={buildOutlookUrl(w)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#4b5563', textDecoration: 'none', fontSize: '12px' }}
                            title="Outlook.com"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24">
                              <path d="M24 7.387v10.478c0 .23-.08.424-.238.582a.793.793 0 01-.582.238h-8.4v-12.1h8.4c.23 0 .424.08.582.237A.793.793 0 0124 7.387z" fill="#0364B8"/>
                              <path d="M14.78 6.585v12.1H6l-.002-12.1h8.782z" fill="#0A2767"/>
                              <path d="M24 7.387L14.78 13.3V6.585h8.4c.23 0 .424.08.582.237A.793.793 0 0124 7.387z" fill="#28A8EA"/>
                              <path d="M14.78 6.585V13.3L24 7.387a.793.793 0 00-.238-.565.793.793 0 00-.582-.237h-8.4z" fill="#0078D4"/>
                              <path d="M0 7.75v8.5A1.25 1.25 0 001.25 17.5h8.5a1.25 1.25 0 001.25-1.25v-8.5A1.25 1.25 0 009.75 6.5h-8.5A1.25 1.25 0 000 7.75z" fill="#0078D4"/>
                              <path d="M5.5 9.5c-1.933 0-3.25 1.455-3.25 3.038 0 1.645 1.36 3.062 3.282 3.062 1.933 0 3.218-1.44 3.218-3.03C8.75 10.91 7.405 9.5 5.5 9.5zm.016 4.956c-1.076 0-1.766-.88-1.766-1.903 0-1.044.72-1.91 1.75-1.91 1.076 0 1.766.897 1.766 1.918 0 1.037-.716 1.895-1.75 1.895z" fill="white"/>
                            </svg>
                            Outlook
                          </a>
                          <a
                            href={buildIcs(w)}
                            download={`fishing-${idx + 1}.ics`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', color: '#4b5563', textDecoration: 'none', fontSize: '12px' }}
                            title="Download .ics (Apple Calendar, etc.)"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="3" />
                              <path d="M3 8h18" />
                              <path d="M8 1v4M16 1v4" strokeLinecap="round"/>
                              <path d="M12 12v5M9.5 14.5L12 17l2.5-2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            .ics
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <p className="mt-1 text-sm text-gray-500 italic">No safe fishing periods at this location in the forecast period.</p>
            )}
          </div>

          {forecasts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No forecast data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" style={{ borderSpacing: '0.5rem 0', borderCollapse: 'separate' }}>
                <thead>
                  <tr className="text-xs text-gray-400 text-left">
                    <th rowSpan={2} className="pb-2">Time</th>
                    <th colSpan={3} className="pb-0">Score</th>
                    <th colSpan={2} className="pb-0">Why</th>
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-400 text-left">
                    <th className="pb-2">Total</th>
                    <th className="pb-2">Safety</th>
                    <th className="pb-2">Fishing</th>
                    <th className="pb-2">Safety</th>
                    <th className="pb-2">Fishing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scoredForecasts.map(({ forecast, score, safetyScore, fishingScore, reasons }, i) => {
                    const isMidnight = i > 0 && (() => {
                      const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                      return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(scoredForecasts[i - 1].forecast.time));
                    })();

                    const rows: React.ReactNode[] = [];
                    if (isMidnight) {
                      rows.push(
                        <tr key={`midnight-${forecast.time}`} aria-hidden="true">
                          <td colSpan={6} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                        </tr>
                      );
                    }

                    rows.push(
                      <tr key={forecast.time} id={`t-${forecast.time}`} style={{ verticalAlign: 'top', scrollMarginTop: '4rem' }}>
                        <td className="py-2 text-sm font-medium tabular-nums whitespace-nowrap" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                          {formatTime(forecast.time)}
                        </td>
                        <td className="py-2 text-center text-sm tabular-nums" style={{ color: getScoreColor(score), backgroundColor: getScoreBg(score), fontWeight: 800, ...(bestWindowIndices.has(i) ? { outline: '2px solid #2563eb', outlineOffset: '-1px', borderRadius: '4px' } : {}) }}>
                          {score}%
                        </td>
                        <td className="py-2 text-center tabular-nums text-xs font-normal text-gray-600">
                          {safetyScore}%
                        </td>
                        <td className="py-2 text-center tabular-nums text-xs text-gray-600" style={
                          reasons.filter(r => r.category === 'fishing').every(r => r.tone === 'good')
                            ? { color: '#15803d', fontWeight: 700 }
                            : {}
                        }>
                          {fishingScore}%
                        </td>
                        <td className="py-2 text-xs">
                          {(() => {
                            const safetyReasons = reasons.filter(r => r.category === 'safety');
                            return safetyReasons.length === 0 ? '—' : safetyReasons.map((r, j) => (
                              <span key={j}>
                                {j > 0 && <span className="text-gray-300"> · </span>}
                                <span style={{ color: r.tone === 'danger' ? '#991b1b' : r.tone === 'bad' ? '#c2410c' : '#15803d' }}>
                                  {r.text}
                                </span>
                              </span>
                            ));
                          })()}
                        </td>
                        <td className="py-2 text-xs">
                          {(() => {
                            const fishingReasons = reasons.filter(r => r.category === 'fishing');
                            return fishingReasons.length === 0 ? '—' : fishingReasons.map((r, j) => (
                              <span key={j}>
                                {j > 0 && <span className="text-gray-300"> · </span>}
                                <span style={{ color: r.tone === 'danger' ? '#991b1b' : r.tone === 'bad' ? '#c2410c' : '#15803d' }}>
                                  {r.text}
                                </span>
                              </span>
                            ));
                          })()}
                        </td>
                      </tr>
                    );

                    return rows;
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }} className="mt-6">
            <div style={{ display: 'flex', borderRadius: '0.5rem', overflow: 'hidden' }}>
              <a
                href="/score/about"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937', borderRight: '2px solid white' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About Fishing Score</span>
              </a>
              <a
                href="/about"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937', borderRight: '2px solid white' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About NoFish</span>
              </a>
              <a
                href="https://github.com/ChrVage/NoFish/issues/new/choose"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Feedback</span>
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
