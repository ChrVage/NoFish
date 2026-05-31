import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCombinedForecast } from '@/lib/api/weather';
import { reverseGeocode } from '@/lib/api/geocoding';
import { queryProtectionZones } from '@/lib/api/fiskeridirektoratet';
import { timeAnchor } from '@/lib/utils/timezone';
import { parseZoomParam, buildLocationUrl } from '@/lib/utils/params';
import Header from '@/components/Header';
import BackButton from '@/components/BackButton';
import PageNav from '@/components/PageNav';
import { enrichForecasts } from '@/lib/utils/enrichForecasts';
import {
  classifyFishingLocationContext,
  computeFishingScore,
  findBestWindows,
  getScoreBg,
  getScoreColor,
  getSpeciesTargetGuidance,
  recommendFishingMethods,
} from '@/lib/scoring/fishingScore';
import { getTimeColumnStyle } from '@/lib/utils/sunPhaseStyle';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackBanner from '@/components/FeedbackBanner';
import BookingButton, { type BookingEntry } from '@/components/BookingButton';
import TuningControls from '@/components/TuningControls';
import { BOAT_SIZE_OPTIONS, parseTuningFromSearchParams, resolveTuningSelection } from '@/lib/utils/tuning';
import { formatForecastTime } from '@/lib/utils/formatTime';
import type { Metadata } from 'next';

/** True when ≥50 % of the hour is in the "day" sun phase. */
function isDaylight(segments: { phase: string; fraction: number }[] | undefined): boolean {
  if (!segments || segments.length === 0) { return true; }
  const dayFrac = segments.filter(s => s.phase === 'day').reduce((sum, s) => sum + s.fraction, 0);
  return dayFrac >= 0.5;
}
import BookingBanner from '@/components/BookingBanner';
import HashScroller from '@/components/HashScroller';
import SafetyContacts from '@/components/SafetyContacts';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'score' });
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: true },
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string; sea?: string; boat?: string; fish?: string; method?: string }>;
}

export default async function ScorePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'score' });
  const tTuning = await getTranslations({ locale, namespace: 'tuning' });
  const { lat: latStr, lng: lngStr, zoom: zoomStr, sea: seaStr, boat: boatStr, fish: fishStr, method: methodStr } = await searchParams;
  const lat = parseFloat(latStr ?? '');
  const lng = parseFloat(lngStr ?? '');
  const validZoom = parseZoomParam(zoomStr);

  if (!latStr || !lngStr || isNaN(lat) || isNaN(lng)) {
    notFound();
  }

  const isSea = seaStr === '0' ? false : seaStr === '1' ? true : undefined;
  const parsedTuning = parseTuningFromSearchParams({ boat: boatStr, fish: fishStr, method: methodStr });
  const tuning = resolveTuningSelection(parsedTuning);
  const headerFishingRulesUrl = tuning.fish === 'salmon'
    ? 'https://www.fiskeridir.no/fritidsfiske/laksefiske-i-sjoen'
    : 'https://www.fiskeridir.no/fritidsfiske';
  const hasTuningSelection = parsedTuning.boat !== undefined || parsedTuning.fish !== undefined || parsedTuning.method !== undefined;
  const bestWindowHeading = (() => {
    if (!hasTuningSelection) { return t('windows.heading'); }
    const parts: string[] = [];
    if (parsedTuning.method) {
      const label = tTuning(`method.${parsedTuning.method}`);
      parts.push(t('windows.forMethod', { method: label.toLowerCase() }));
    }
    if (parsedTuning.fish && parsedTuning.fish !== 'general') {
      const label = tTuning(`fish.${parsedTuning.fish}`);
      parts.push(t('windows.forFish', { fish: label.toLowerCase() }));
    }
    if (parsedTuning.boat) {
      const label = BOAT_SIZE_OPTIONS.find((o) => o.value === parsedTuning.boat)?.label ?? parsedTuning.boat;
      parts.push(t('windows.fromBoat', { boat: label }));
    }
    return t('windows.headingWith', { description: parts.join(', ') });
  })();

  const [locationData, weatherResult, protectionZones] = await Promise.all([
    reverseGeocode(lat, lng),
    getCombinedForecast(lat, lng, isSea !== undefined ? { isSea } : undefined),
    queryProtectionZones(lat, lng),
  ]);

  const { forecasts: rawForecasts, oceanForecastLat, currentForecastLat, currentForecastLng: _currentForecastLng, currentForecastDistanceKm: _currentForecastDistanceKm } = weatherResult;
  const forecasts = enrichForecasts(rawForecasts);
  const { timezone } = weatherResult;
  const hasWaveData = oceanForecastLat !== undefined;
  const hasCurrentData = currentForecastLat !== undefined;

  // Pre-compute scores for all forecasts (depth-adaptive)
  const depth = locationData?.isSea && locationData.elevation !== undefined
    ? Math.abs(locationData.elevation)
    : undefined;
  const locationContext = classifyFishingLocationContext({
    isSea: locationData?.isSea,
    terrain: locationData?.terrain,
    objectType: locationData?.objectType,
    name: locationData?.name,
    municipality: locationData?.municipality,
  });
  const speciesGuidance = getSpeciesTargetGuidance({
    fish: tuning.fish,
    depth,
    locationContext,
  });
  const scoredForecasts = forecasts.map((f) => ({
    forecast: f,
    ...computeFishingScore(f, {
      depth,
      boat: tuning.boat,
      fish: tuning.fish,
      timezone,
      locationContext,
    }),
  }));
  const methodRecommendations = recommendFishingMethods(scoredForecasts, timezone, tuning.fish);

  // Find best fishing windows (top 2–3 non-overlapping)
  // For nets: 6–8 hour windows with safe deployment and retrieval.
  // For other methods: 1–3 hour windows.
  const bestWindows = findBestWindows(scoredForecasts, {
    method: tuning.method,
    timezone,
  });

  // Map each row index → window index (for data-window attribute)
  const rowToWindow = new Map<number, number>();
  bestWindows.forEach((w, wIdx) => { for (let j = 0; j < w.len; j++) { rowToWindow.set(w.start + j, wIdx); } });

  // For net method: mark the first and last row of each window as set/pickup
  const netSetHours = new Set<number>();
  const netPickupHours = new Set<number>();
  if (tuning.method === 'net') {
    bestWindows.forEach((w) => {
      netSetHours.add(w.start);
      netPickupHours.add(w.start + w.len - 1);
    });
  }

  // Location name for booking entries
  const locationName = locationData?.municipality && locationData.municipality !== 'Unknown municipality' && locationData.name !== locationData.municipality
    ? `${locationData.name}, ${locationData.municipality}`
    : locationData?.name ?? locationData?.municipality ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  const formatTime = (isoString: string) => formatForecastTime(isoString, timezone);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
          </div>
          <PageNav
            lat={lat}
            lng={lng}
            zoom={validZoom}
            sea={seaStr}
            boat={tuning.boat}
            fish={tuning.fish}
            method={tuning.method}
            current="score"
            availablePages={locationData?.isSea === false ? ['details'] : undefined}
          />
          <a
            href={headerFishingRulesUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: '0.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              fontSize: '0.75rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {t('fishingRules')}
          </a>
        </div>
      </Header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>
          <div className="mb-6 border-b border-gray-200 pb-4">
            {locationData && (
              <h2 className="text-2xl font-bold text-maritime-teal-800 mb-1">
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
                    ? `${t('coordDepth', { depth: Math.abs(Math.round(locationData.elevation)) })}`
                    : `${t('coordElevation', { elevation: Math.round(locationData.elevation) })}`}
                </span>
              )}
            </p>
            {!hasWaveData && locationData?.isSea !== false && (
              <p className="text-xs text-amber-600 mt-1">
                {t('noOceanData')}
              </p>
            )}
            {hasWaveData && !hasCurrentData && (
              <p className="text-xs text-amber-600 mt-1">
                {t('noCurrentWarning')}
              </p>
            )}
            {protectionZones.length > 0 && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-bold text-red-800 mb-1">⚠ Fishing restrictions at this location:</p>
                <ul className="text-xs text-red-700 space-y-0.5 list-disc pl-4">
                  {protectionZones.map((z, i) => (
                    <li key={i}>
                      <span className="font-semibold">{z.name}</span>
                      {z.description && <span> — {z.description}</span>}
                      {z.dateFrom && z.dateTo && (
                        <span className="text-red-500"> ({z.dateFrom} → {z.dateTo})</span>
                      )}
                      {z.url && (
                        <>
                          {' '}
                          <a href={z.url} target="_blank" rel="noopener noreferrer" className="underline text-red-600 hover:text-red-800">
                            Lovdata ↗
                          </a>
                        </>
                      )}
                      {z.infoUrl && (
                        <>
                          {' '}
                          <a href={z.infoUrl} target="_blank" rel="noopener noreferrer" className="underline text-red-600 hover:text-red-800">
                            Fiskeridir ↗
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {speciesGuidance && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-900 mb-1">{t('salmonGuidance.heading')}</p>
                <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                  <li>
                    {t('salmonGuidance.depthRange', {
                      min: speciesGuidance.targetDepthMinM,
                      max: speciesGuidance.targetDepthMaxM,
                    })}
                  </li>
                  <li>
                    {t('salmonGuidance.currentRange', {
                      min: speciesGuidance.targetCurrentMinMs.toFixed(2),
                      max: speciesGuidance.targetCurrentMaxMs.toFixed(2),
                    })}
                  </li>
                  <li>
                    {t('salmonGuidance.trollingRange', {
                      min: speciesGuidance.targetTrollingMinKnots.toFixed(1),
                      max: speciesGuidance.targetTrollingMaxKnots.toFixed(1),
                    })}
                  </li>
                  <li>
                    {t('salmonGuidance.locationContextPrefix')} {speciesGuidance.locationContext === 'salmon-path'
                      ? t('salmonGuidance.locationContextPath')
                      : speciesGuidance.locationContext === 'fjord'
                        ? t('salmonGuidance.locationContextFjord')
                        : speciesGuidance.locationContext === 'open-sea'
                          ? t('salmonGuidance.locationContextOpenSea')
                          : t('salmonGuidance.locationContextUnknown')}.
                  </li>
                  <li>{t('salmonGuidance.restrictionNote')}</li>
                </ul>
              </div>
            )}
            <h3 className="text-sm font-bold text-maritime-teal-800 mt-2" style={{ marginBottom: '2px' }}>{bestWindowHeading}</h3>
            {bestWindows.length > 0 ? (() => {
              const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone });
              const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                  {bestWindows.map((w, idx) => {
                    const startDate = new Date(scoredForecasts[w.start].forecast.time);
                    const lastDate = new Date(scoredForecasts[w.start + w.len - 1].forecast.time);
                    const endHour = new Date(lastDate.getTime() + 3600000);
                    const avg = Math.round(w.avg);
                    return (
                      <a
                        key={idx}
                        href={`#w-${idx}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 0', textDecoration: 'none', color: 'inherit' }}
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
              <p className="mt-1 text-sm text-gray-500 italic">{t('windows.noSafePeriods')}</p>
            )}

          </div>

          {forecasts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('noForecastData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 text-left">
                    <th rowSpan={2} className="pb-2 pr-2" style={{ width: '1%' }}>{t('table.time')}</th>
                    <th colSpan={4} className="pb-0">{t('table.score')}</th>
                    <th colSpan={2} className="pb-0">{t('table.notes')}</th>
                    <th rowSpan={2} className="pb-2" aria-label="Feedback" />
                  </tr>
                  <tr className="border-b border-gray-200 text-xs text-gray-400 text-left">
                    <th className="pb-2" aria-label="Calendar" />
                    <th className="pb-2">{t('table.total')}</th>
                    <th className="pb-2">{t('table.safety')}</th>
                    <th className="pb-2">{t('table.fishing')}</th>
                    <th className="pb-2">{t('table.safety')}</th>
                    <th className="pb-2">{t('table.fishing')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    return scoredForecasts.map(({ forecast, score, safetyScore, fishingScore, reasons }, i) => {
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

                    const anchor = timeAnchor(forecast.time, timezone);

                    rows.push(
                      <tr key={forecast.time} id={anchor} data-window={rowToWindow.has(i) ? rowToWindow.get(i) : undefined} style={{ verticalAlign: 'top', scrollMarginTop: '4rem' }}>
                        <td className="pl-4 pr-1 py-3 text-sm font-medium tabular-nums whitespace-nowrap" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                          <Link
                            href={`${buildLocationUrl('details', {
                              lat,
                              lng,
                              zoom: validZoom,
                              sea: seaStr,
                              boat: tuning.boat,
                              fish: tuning.fish,
                              method: tuning.method,
                            }, locale)}#${anchor}`}
                            title="View details for this hour"
                            className="time-score-btn"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 7px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              color: 'inherit',
                              backgroundColor: isDaylight(forecast.sunPhaseSegments) ? '#fefce8' : 'rgba(255,255,255,0.12)',
                            }}
                          >
                            <span>{formatTime(forecast.time)}</span>
                          </Link>
                          {netSetHours.has(i) && (
                            <span style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.05em', marginTop: '2px', paddingLeft: '7px' }}
                              title="Recommended net deployment time">
                              SET NET ▼
                            </span>
                          )}
                          {netPickupHours.has(i) && (
                            <span style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.05em', marginTop: '2px', paddingLeft: '7px' }}
                              title="Recommended net retrieval time">
                              PICKUP ▲
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center tabular-nums text-sm" style={{
                          fontWeight: (score >= 50 || score < 35) ? 800 : 500,
                        }}>
                          <span style={{
                            padding: '2px 5px',
                            borderRadius: '3px',
                            color: getScoreColor(score),
                            backgroundColor: getScoreBg(score),
                            whiteSpace: 'nowrap',
                          }}>
                            {score}%
                          </span>
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
                        <td className="py-2 text-center tabular-nums text-xs font-normal text-gray-600">
                          {safetyScore}%
                        </td>
                        <td className="py-2 text-center tabular-nums text-xs" style={
                          fishingScore >= 50
                            ? { color: '#15803d', fontWeight: 700 }
                            : fishingScore < 35
                              ? { color: '#c2410c', fontWeight: 700 }
                              : { color: '#4b5563' }
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
                  });
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {methodRecommendations.length > 0 && (
            <section
              aria-label="Method scores"
              style={{ marginTop: '1.5rem', borderRadius: '14px', backgroundColor: '#f3f4f6', padding: '0.875rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  {t('methodScores')}
                </h3>
                <div style={{ flexShrink: 0, minWidth: '160px', maxWidth: '260px', flex: '0 1 220px' }}>
                  <TuningControls currentPage="score" lat={lat} lng={lng} zoom={validZoom} sea={seaStr} fields={['fish']} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
                {methodRecommendations.map((m) => {
                  const label = tTuning(`method.${m.method}`);
                  return (
                    <div
                      key={m.method}
                      style={{
                        borderRadius: '10px',
                        backgroundColor: '#ffffff',
                        padding: '0.625rem 0.75rem',
                        boxShadow: '0 0 0 1px #e5e7eb',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        {m.recommended && (
                          <span style={{ flexShrink: 0, borderRadius: '9999px', backgroundColor: '#1f2937', color: '#ffffff', padding: '2px 7px', fontSize: '9px', fontWeight: 600, lineHeight: 1, letterSpacing: '0.02em' }}>
                            BEST
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '15px',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          borderRadius: '6px',
                          color: getScoreColor(m.score),
                          backgroundColor: getScoreBg(m.score),
                          padding: '1px 7px',
                        }}
                      >
                        {m.score}%
                      </span>
                      <p style={{ marginTop: '0.375rem', marginBottom: 0, fontSize: '11px', color: '#6b7280', lineHeight: 1.35 }}>
                        {m.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section
            aria-label="Settings"
            style={{ marginTop: '1rem', borderRadius: '14px', backgroundColor: '#f3f4f6', padding: '0.875rem' }}
          >
            <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.625rem 0' }}>
              {t('settings')}
            </h3>
            <TuningControls currentPage="score" lat={lat} lng={lng} zoom={validZoom} sea={seaStr} fields={['boat', 'method']} />
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
            <a
              href={locale !== 'no' ? `/${locale}/score/about` : '/score/about'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('aboutScore')}</span>
            </a>
            <a
              href={locale !== 'no' ? `/${locale}/about` : '/about'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('aboutNoFish')}</span>
            </a>
            <a
              href="https://github.com/ChrVage/NoFish/issues/new/choose"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('feedback')}</span>
            </a>
            <a
              href="https://www.fiskeridir.no/fritidsfiske"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', textDecoration: 'none', backgroundColor: '#f3f4f6', color: '#1f2937' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{t('fishingRules')}</span>
            </a>
          </div>

          {locationData?.isSea !== false && <SafetyContacts />}

        </div>
      </main>

      <FeedbackBanner />
      <BookingBanner restrictions={protectionZones.map(z => {
        let text = z.name;
        if (z.description) { text += ` — ${z.description}`; }
        if (z.dateFrom && z.dateTo) { text += ` (${z.dateFrom} → ${z.dateTo})`; }
        return text;
      })} />
      <HashScroller />
    </div>
  );
}
