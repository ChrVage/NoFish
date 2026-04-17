import { notFound } from 'next/navigation';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { getTimezone } from '@/lib/utils/timezone';
import { parseZoomParam, buildLocationUrl } from '@/lib/utils/params';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import { computeFishingScore, findBestWindows, getScoreColor, getScoreBg } from '@/lib/scoring/fishingScore';
import { getTimeColumnStyle } from '@/lib/utils/sunPhaseStyle';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import BookingButton, { type BookingEntry } from '@/components/BookingButton';
import BookingBanner from '@/components/BookingBanner';

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

  // Location name for booking entries
  const locationName = locationData?.municipality && locationData.municipality !== 'Unknown municipality' && locationData.name !== locationData.municipality
    ? `${locationData.name}, ${locationData.municipality}`
    : locationData?.name || locationData?.municipality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

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

              return (
                <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {bestWindows.map((w, idx) => {
                    const startDate = new Date(scoredForecasts[w.start].forecast.time);
                    const lastDate = new Date(scoredForecasts[w.start + w.len - 1].forecast.time);
                    const endHour = new Date(lastDate.getTime() + 3600000);
                    const avg = Math.round(w.avg);
                    return (
                      <a
                        key={idx}
                        href={`#t-${scoredForecasts[w.start].forecast.time}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', textDecoration: 'none', color: 'inherit' }}
                        title="Jump to this window in the table"
                      >
                        <span style={{ fontSize: '12px', color: '#9ca3af', width: '16px', textAlign: 'right', flexShrink: 0 }}>{idx + 1}.</span>
                        <span
                          style={{
                            display: 'inline-block', minWidth: '42px', textAlign: 'center',
                            borderRadius: '4px', padding: '2px 6px', fontSize: '13px', fontWeight: 800,
                            color: getScoreColor(avg), backgroundColor: getScoreBg(avg),
                          }}
                        >
                          {avg}%
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                          {dateFmt.format(startDate)}{' '}
                          {timeFmt.format(startDate)}–{timeFmt.format(endHour)}
                        </span>
                      </a>
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
                    <th rowSpan={2} className="pb-2" aria-label="Calendar" />
                    <th colSpan={3} className="pb-0">Score</th>
                    <th colSpan={2} className="pb-0">Why</th>
                    <th rowSpan={2} className="pb-2" aria-label="Feedback" />
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
                          <td colSpan={8} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                        </tr>
                      );
                    }

                    rows.push(
                      <tr key={forecast.time} id={`t-${forecast.time}`} style={{ verticalAlign: 'top', scrollMarginTop: '4rem' }}>
                        <td className="py-2 text-sm font-medium tabular-nums whitespace-nowrap" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                          {formatTime(forecast.time)}
                        </td>
                        <td className="py-2 text-center">
                          <BookingButton entry={{
                            time: forecast.time,
                            score,
                            safetyScore,
                            fishingScore,
                            windSpeed: forecast.windSpeed,
                            windGust: forecast.windGust,
                            waveHeight: forecast.waveHeight,
                            wavePeriod: forecast.wavePeriod,
                            currentSpeed: forecast.currentSpeed,
                            temperature: forecast.temperature,
                            seaTemperature: forecast.seaTemperature,
                            pressure: forecast.pressure,
                            tidePhase: forecast.tidePhase,
                            moonPhase: forecast.moonPhase,
                            locationName,
                            lat,
                            lng,
                          } satisfies BookingEntry} />
                        </td>
                        <td className="py-2 text-center text-sm tabular-nums" style={{ color: getScoreColor(score), backgroundColor: getScoreBg(score), fontWeight: 800, ...(bestWindowIndices.has(i) ? { outline: '2px solid #2563eb', outlineOffset: '-1px', borderRadius: '4px' } : {}) }}>
                          <a
                            href={`${buildLocationUrl('details', { lat, lng, zoom: validZoom, sea: seaStr, ht: forecast.time })}#t-${forecast.time}`}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            title="View details for this hour"
                          >
                            {score}%
                          </a>
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
                        <td className="py-2 text-center">
                          <FeedbackButton item={{
                            id: `score-${forecast.time}`,
                            page: 'Score',
                            time: formatTime(forecast.time),
                            lat,
                            lng,
                            locationName: locationData?.name,
                            summary: `Score ${score}% (Safety ${safetyScore}%, Fishing ${fishingScore}%)`,
                          }} />
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

      <FeedbackBanner />
      <BookingBanner />
    </div>
  );
}
