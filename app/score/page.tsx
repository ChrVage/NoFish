import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { formatDistance } from '@/lib/utils/distance';
import { parseZoomParam } from '@/lib/utils/params';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import { computeFishingScore, findBestWindows, getScoreColor, getScoreBg } from '@/lib/scoring/fishingScore';

interface PageProps {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string }>;
}

// ── Sun-phase background colour (same as ForecastTable Time column) ─────────
const sunPhaseColors: Record<string, [number, number, number]> = {
  day:      [255, 255, 255],
  civil:    [190, 195, 210],
  nautical: [30,  50,  90],
  night:    [0,   0,   0],
};

function getTimeColumnStyle(
  segments: { phase: string; fraction: number }[] | undefined,
): React.CSSProperties {
  if (!segments || segments.length === 0) return {};
  let r = 0, g = 0, b = 0;
  for (const seg of segments) {
    const c = sunPhaseColors[seg.phase] ?? [128, 128, 128];
    r += c[0] * seg.fraction;
    g += c[1] * seg.fraction;
    b += c[2] * seg.fraction;
  }
  r = Math.round(r); g = Math.round(g); b = Math.round(b);
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  const textColor = luminance < 140 ? '#ffffff' : '#111827';
  return { backgroundColor: `rgb(${r}, ${g}, ${b})`, color: textColor };
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

  const { forecasts: rawForecasts } = weatherResult;
  const forecasts = enrichForecasts(rawForecasts);
  const hasOceanData = forecasts.some(f => f.waveHeight !== undefined);
  const timezone = getTimezone(lat, lng);

  // Pre-compute scores for all forecasts
  const scoredForecasts = forecasts.map(f => ({ forecast: f, ...computeFishingScore(f) }));

  // Find best fishing windows (top 2 non-overlapping, 1–3 hours)
  const bestWindows = findBestWindows(scoredForecasts);

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
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    return `${weekday}. ${day}. ${hour}:${minute}`;
  };

  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <PageNav lat={lat} lng={lng} zoom={validZoom} sea={seaStr} current="score" />
        </div>
      </Header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <>
                <h2 className="text-2xl font-bold text-ocean-900 mb-1">
                  {locationData.name}
                  {locationData.placeDistanceM !== undefined && locationData.placeDistanceM > 100 && (
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({formatDistance(locationData.placeDistanceM)} away)
                    </span>
                  )}
                </h2>
                {locationData.municipality && locationData.municipality !== 'Unknown municipality' && (
                  <p className="text-sm text-gray-500">
                    {locationData.municipality}
                  </p>
                )}
              </>
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
            {bestWindows.length > 0 && (() => {
              const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
              const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });
              const locationName = locationData
                ? (locationData.name !== locationData.municipality
                    ? `${locationData.name}, ${locationData.municipality}`
                    : locationData.municipality)
                : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
              const icsDateFmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

              const buildIcs = (w: (typeof bestWindows)[0]) => {
                const hours = [];
                for (let j = 0; j < w.len; j++) hours.push(scoredForecasts[w.start + j]);
                const start = new Date(hours[0].forecast.time);
                const last = new Date(hours[hours.length - 1].forecast.time);
                const end = new Date(last.getTime() + 3600000);
                const avg = Math.round(w.avg);

                // Build weather description from hourly data
                const lines: string[] = [`NoFish score: ${avg}%`, ''];
                for (const h of hours) {
                  const f = h.forecast;
                  const t = timeFmt.format(new Date(f.time));
                  const parts: string[] = [`Score: ${h.score}%`];
                  if (f.windSpeed !== undefined) parts.push(`Wind: ${f.windSpeed.toFixed(1)} m/s${f.windGust ? ` (gust ${f.windGust.toFixed(1)})` : ''}${f.windDirection !== undefined ? ` from ${f.windDirection}°` : ''}`);
                  if (f.waveHeight !== undefined) parts.push(`Waves: ${f.waveHeight.toFixed(1)} m${f.waveDirection !== undefined ? ` from ${f.waveDirection}°` : ''}`);
                  if (f.currentSpeed !== undefined) parts.push(`Current: ${f.currentSpeed.toFixed(2)} m/s${f.currentDirection !== undefined ? ` toward ${f.currentDirection}°` : ''}`);
                  if (f.temperature !== undefined) parts.push(`Air: ${f.temperature.toFixed(1)}°C`);
                  if (f.seaTemperature !== undefined) parts.push(`Sea: ${f.seaTemperature.toFixed(1)}°C`);
                  if (f.precipitation !== undefined && f.precipitation > 0) parts.push(`Precip: ${f.precipitation.toFixed(1)} mm`);
                  if (f.cloudCover !== undefined) parts.push(`Cloud: ${f.cloudCover}%`);
                  if (f.pressure !== undefined) parts.push(`Pressure: ${f.pressure.toFixed(0)} hPa`);
                  if (f.humidity !== undefined) parts.push(`Humidity: ${f.humidity}%`);
                  if (f.tidePhase) parts.push(`Tide: ${f.tidePhase}`);
                  if (f.moonPhase) parts.push(`Moon: ${f.moonPhase}`);
                  if (f.sunPhase) parts.push(`Sun: ${f.sunPhase}`);
                  lines.push(`${t}:  ${parts.join(' | ')}`);
                }
                const desc = lines.join('\\n');

                const ics = [
                  'BEGIN:VCALENDAR',
                  'VERSION:2.0',
                  'PRODID:-//NoFish//Score//EN',
                  'BEGIN:VEVENT',
                  `DTSTART:${icsDateFmt(start)}`,
                  `DTEND:${icsDateFmt(end)}`,
                  `SUMMARY:🎣 Fishing ${avg}% – ${locationName}`,
                  `DESCRIPTION:${desc}`,
                  `LOCATION:${mapsUrl}`,
                  `GEO:${lat};${lng}`,
                  `URL:${mapsUrl}`,
                  `UID:nofish-${start.getTime()}@nofish`,
                  'END:VEVENT',
                  'END:VCALENDAR',
                ].join('\r\n');
                return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
              };

              return (
                <div className="mt-3">
                  <h3 className="text-sm font-bold text-ocean-900">Best fishing windows:</h3>
                  <table className="text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0' }}>
                    <tbody>
                      {bestWindows.map((w, idx) => {
                        const startDate = new Date(scoredForecasts[w.start].forecast.time);
                        const lastDate = new Date(scoredForecasts[w.start + w.len - 1].forecast.time);
                        const endHour = new Date(lastDate.getTime() + 3600000);
                        const avg = Math.round(w.avg);
                        const icsHref = buildIcs(w);
                        return (
                          <tr key={idx}>
                            <td className="py-0.5 pr-8">
                              <span
                                className="inline-block w-11 text-center font-bold rounded px-1.5 py-0.5 text-xs"
                                style={{ color: getScoreColor(avg), backgroundColor: getScoreBg(avg) }}
                              >
                                {avg}%
                              </span>
                            </td>
                            <td className="py-0.5 pr-8 text-ocean-800 font-medium whitespace-nowrap">
                              {dateFmt.format(startDate)}{' '}
                              {timeFmt.format(startDate)}–{timeFmt.format(endHour)}
                            </td>
                            <td className="py-0.5">
                              <a
                                href={icsHref}
                                download={`fishing-${idx + 1}.ics`}
                                className="inline-flex items-center gap-0.5 text-xs text-ocean-600 hover:text-ocean-800"
                                title="Add to calendar"
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                .ics
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {forecasts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No forecast data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm" style={{ borderSpacing: '0.5rem 0', borderCollapse: 'separate' }}>
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                    <th className="pb-2">Time</th>
                    <th className="pb-2 text-center">Score</th>
                    <th className="pb-2">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scoredForecasts.map(({ forecast, score, reasons }, i) => {
                    const isMidnight = i > 0 && (() => {
                      const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                      return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(scoredForecasts[i - 1].forecast.time));
                    })();

                    const rows: React.ReactNode[] = [];
                    if (isMidnight) {
                      rows.push(
                        <tr key={`midnight-${forecast.time}`} aria-hidden="true">
                          <td colSpan={3} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                        </tr>
                      );
                    }

                    rows.push(
                      <tr key={forecast.time} style={{ verticalAlign: 'top' }}>
                        <td className="py-2 text-sm font-medium tabular-nums whitespace-nowrap" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                          {formatTime(forecast.time)}
                        </td>
                        <td className="py-2 text-center font-bold tabular-nums" style={{ color: getScoreColor(score), backgroundColor: getScoreBg(score) }}>
                          {score}%
                        </td>
                        <td className="py-2 text-xs">
                          {reasons.length === 0 ? '—' : reasons.map((r, j) => (
                            <span key={j}>
                              {j > 0 && <span className="text-gray-300"> · </span>}
                              <span style={{ color: r.tone === 'danger' ? '#991b1b' : r.tone === 'bad' ? '#c2410c' : '#15803d' }}>
                                {r.text}
                              </span>
                            </span>
                          ))}
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
                href="https://github.com/ChrVage/NoFish/blob/main/readme-score.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937', borderRight: '2px solid white' }}
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>About Fishing Score</span>
              </a>
              <a
                href="https://github.com/ChrVage/NoFish/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
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
