'use client';

import React from 'react';
import Link from 'next/link';
import type { EnrichedForecast } from '@/lib/utils/enrichForecasts';
import { getTimeColumnStyle } from '@/lib/utils/sunPhaseStyle';
import { timeAnchor } from '@/lib/utils/timezone';
import { getScoreColor, getScoreBg } from '@/lib/scoring/fishingScore';
import FeedbackButton from '@/components/FeedbackButton';

/** True when ≥50 % of the hour is in the "day" sun phase. */
function isDaylight(segments: { phase: string; fraction: number }[] | undefined): boolean {
  if (!segments || segments.length === 0) { return true; }
  const dayFrac = segments.filter(s => s.phase === 'day').reduce((sum, s) => sum + s.fraction, 0);
  return dayFrac >= 0.5;
}

interface ForecastTableProps {
  forecasts: EnrichedForecast[];
  timezone: string;
  /** Force-hide ocean columns even when wave data exists (e.g. land location). */
  hideOceanData?: boolean;
  /** Coordinates and location name for feedback items. */
  lat?: number;
  lng?: number;
  locationName?: string;
  /** Per-row fishing scores (parallel to forecasts). Shown as badge in time column. */
  scores?: number[];
  /** Base URL for the score page (without hash). Badges link here with #t-{time}. */
  scoreBaseUrl?: string;
}

// Weather symbol mapping — day/night-aware to match yr.no
// MET API symbol_code values contain _day, _night, or _polartwilight suffixes
const getWeatherSymbol = (symbolCode: string | undefined) => {
  if (!symbolCode) {return '❓';}
  const code = symbolCode.toLowerCase();
  const isNight = code.includes('_night');

  if (code.includes('clearsky'))       {return isNight ? '🌙' : '☀️';}
  if (code.includes('fair'))           {return isNight ? '🌙' : '🌤️';}
  if (code.includes('partlycloudy'))   {return isNight ? '⛅' : '⛅';}
  if (code.includes('cloudy'))         {return '☁️';}
  if (code.includes('fog'))            {return '🌫️';}
  if (code.includes('thunder'))        {return '⛈️';}
  if (code.includes('sleet'))          {return '🌨️';}
  if (code.includes('snow'))           {return '❄️';}
  if (code.includes('heavyrain'))      {return '🌧️';}
  if (code.includes('lightrain') || code.includes('rainshowers')) {return isNight ? '🌧️' : '🌦️';}
  if (code.includes('rain'))           {return '🌧️';}
  return '☁️';
};

// Arrow component for direction visualization
// For "from" directions (wind), adds 180° to point toward where it's going
// For "to" directions (current), uses the value as-is
// For waves, do NOT add 180° (Barentswatch is already 'from' direction, but arrow should point FROM)
const DirectionArrow = ({
  degrees,
  isFromDirection = false,
  className = ''
}: {
  degrees: number | undefined;
  isFromDirection?: boolean;
  className?: string
}) => {
  if (degrees === undefined) {return <span aria-hidden="true">—</span>;}

  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const cardinal = cardinals[Math.round(degrees / 45) % 8];
  const label = isFromDirection ? `From ${cardinal}` : `To ${cardinal}`;

  // Only wind gets 180° rotation. Waves: show as-is. Currents: show as-is.
  const displayDegrees = isFromDirection ? (degrees + 180) % 360 : degrees;

  return (
    <svg
      role="img"
      aria-label={label}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`inline-block ${className}`}
      style={{ transform: `rotate(${displayDegrees}deg)` }}
    >
      <path
        d="M12 2 L16 10 L13 10 L13 22 L11 22 L11 10 L8 10 Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default function ForecastTable({ forecasts, timezone, hideOceanData, lat, lng, locationName, scores, scoreBaseUrl }: ForecastTableProps) {
  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No forecast data available</p>
      </div>
    );
  }

  // If no row has wave data the point is inland — hide ocean-specific columns
  const hasOceanData = !hideOceanData && forecasts.some(f => f.waveHeight !== undefined);
  const precipLabel = 'Precip.';

  // Pre-enriched by the server component — use directly
  const displayForecasts = forecasts;

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
    
    return `${weekday.slice(0, 2)} ${day}. ${hour}:${minute}`;
  };

  const formatValue = (value: number | undefined, decimals: number = 1, unit: string = '') => {
    if (value === undefined || value === null) {return '—';}
    return `${value.toFixed(decimals)}${unit}`;
  };

  // Format wind as "10.5 (15.0) m/s" where (15.0) is the gust
  const formatWind = (speed: number | undefined, gust: number | undefined) => {
    if (speed === undefined) {return <span>—</span>;}
    const gustPart = gust !== undefined
      ? <> ({gust.toFixed(1)})</>
      : null;
    return <><strong>{speed.toFixed(1)}</strong>{gustPart}{' m/s'}</>;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Hourly weather forecast">
          <thead className="bg-maritime-teal-700 text-white">
            {/* API source group header row */}
            <tr className="bg-maritime-teal-800 text-slate-100 text-[10px] tracking-widest">
              <th className="sticky left-0 bg-maritime-teal-800 z-10" aria-hidden="true" />
              {/* MET Norway Locationforecast — always present */}
              <th
                colSpan={7}
                scope="colgroup"
                className="px-4 py-1 text-center font-semibold border-l-2 border-amber-400/50 border-r border-amber-400/20"
              >
                MET Norway Locationforecast
              </th>
              {/* Barentswatch Waveforecast — coastal only */}
              {hasOceanData && (
                <th
                  colSpan={3}
                  scope="colgroup"
                  className="px-4 py-1 text-center font-semibold border-l border-slate-400/20 border-r border-slate-400/20"
                >
                  Barentswatch Waveforecast
                </th>
              )}
              {/* Barentswatch Sea Current */}
              {hasOceanData && (
                <th
                  colSpan={2}
                  scope="colgroup"
                  className="px-4 py-1 text-center font-semibold border-l border-blue-400/20 border-r border-blue-400/20"
                >
                  Barentswatch Sea Current
                </th>
              )}
              {/* MET.no Oceanforecast Sea Temp */}
              {hasOceanData && (
                <th
                  colSpan={1}
                  scope="colgroup"
                  className="px-4 py-1 text-center font-semibold border-l border-cyan-400/20 border-r border-cyan-400/20"
                >
                  MET Sea Temp
                </th>
              )}
              {/* Kartverket — astronomical tides */}
              {hasOceanData && (
                <th
                  colSpan={1}
                  scope="colgroup"
                  className="px-4 py-1 text-center font-semibold border-l border-purple-400/20 border-r border-purple-400/20"
                >
                  Kartverket
                </th>
              )}
              {/* Calculated */}
              <th
                colSpan={2}
                scope="colgroup"
                className="px-4 py-1 text-center font-semibold border-l border-yellow-400/20"
              >
                Calculated
              </th>
              {/* Feedback */}
              <th
                colSpan={1}
                scope="colgroup"
                className="px-4 py-1 text-center font-semibold"
              />
            </tr>

            {/* Column header row */}
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider sticky left-0 bg-maritime-teal-700 z-10 whitespace-nowrap" style={{ width: '1%' }}>
                {scores ? 'Time and Score' : 'Time'}
              </th>

              {/* ── MET Norway Locationforecast columns ── */}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-amber-900/20 border-l-2 border-amber-400/50">
                Wind
              </th>
              <th scope="col" aria-label="Wind direction" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-amber-900/20">
              </th>
              <th scope="col" aria-label="Weather" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-amber-900/20">
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-amber-900/20">
                {precipLabel}
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-amber-900/20 border-r-2 border-amber-400/30">
                Temp
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-amber-900/20 border-r-2 border-amber-400/30">
                Pressure
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-amber-900/20 border-r-2 border-amber-400/30">
                UV
              </th>

              {/* ── Barentswatch Waveforecast columns ── */}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-slate-800/30 border-l-2 border-slate-400/50">
                  Height
                </th>
              )}
              {hasOceanData && (
                <th scope="col" aria-label="Wave direction" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-slate-800/30">
                  Dir
                </th>
              )}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-slate-800/30 border-r-2 border-slate-400/30">
                  Period
                </th>
              )}
              {/* ── Barentswatch Sea Current columns ── */}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-blue-800/30 border-l-2 border-blue-400/50">
                  Current
                </th>
              )}
              {hasOceanData && (
                <th scope="col" aria-label="Current direction" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-blue-800/30 border-r-2 border-blue-400/30">
                  Dir
                </th>
              )}
              {/* ── MET.no Oceanforecast Sea Temp column ── */}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-cyan-800/30 border-l-2 border-cyan-400/50 border-r-2 border-cyan-400/30">
                  Temp
                </th>
              )}
              {/* ── Kartverket column ── */}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-purple-900/20 border-l-2 border-purple-400/50 border-r-2 border-r-purple-400/30">
                  Tide
                </th>
              )}
              {/* ── Calculated column ── */}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-yellow-900/20 border-l-2 border-yellow-400/50">
                Sun
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-yellow-900/20">
                Moon
              </th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider" aria-label="Feedback" />
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {displayForecasts.map((forecast, index) => {
              // Detect the last hourly row (gap to next row jumps from ~1 h to ~6 h)
              const isLastHourly = index < displayForecasts.length - 1 && (() => {
                const thisGap = new Date(displayForecasts[index + 1].time).getTime() - new Date(forecast.time).getTime();
                const prevGap = index > 0
                  ? new Date(forecast.time).getTime() - new Date(displayForecasts[index - 1].time).getTime()
                  : thisGap;
                return prevGap <= 90 * 60_000 && thisGap > 90 * 60_000;
              })();

              // Detect midnight boundary (local date changed since previous row)
              const isMidnight = index > 0 && !isLastHourly && (() => {
                const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(displayForecasts[index - 1].time));
              })();

              // Count total columns for separator rows
              const totalCols = 9 + (hasOceanData ? 7 : 0) + 1 + 1;

              const rows: React.ReactNode[] = [];

              // Insert a thin separator row before midnight rows
              if (isMidnight) {
                rows.push(
                  <tr key={`midnight-${forecast.time}`} aria-hidden="true">
                    <td colSpan={totalCols} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                  </tr>
                );
              }

              const anchor = timeAnchor(forecast.time, timezone);

              rows.push(
              <tr
                key={forecast.time}
                id={anchor}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                style={{ scrollMarginTop: '4rem', ...(isLastHourly ? { boxShadow: '0 3px 0 -1px #9ca3af, 0 6px 0 -1px #9ca3af' } : undefined) }}
              >
                <td
                  className="pl-4 pr-1 py-3 text-sm font-medium sticky left-0 z-10 whitespace-nowrap"
                  style={getTimeColumnStyle(forecast.sunPhaseSegments)}
                >
                  {scores?.[index] !== undefined && scoreBaseUrl ? (
                    <Link
                      href={`${scoreBaseUrl}#${anchor}`}
                      title="View score"
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
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        lineHeight: '1',
                        padding: '1px 3px',
                        borderRadius: '3px',
                        color: getScoreColor(scores[index]),
                        backgroundColor: getScoreBg(scores[index]),
                        whiteSpace: 'nowrap',
                      }}>
                        {scores[index]}%
                      </span>
                    </Link>
                  ) : (
                    <span>{formatTime(forecast.time)}</span>
                  )}
                </td>

                {/* ── MET Norway Locationforecast cells ── */}
                <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-amber-300/50">
                  {formatWind(forecast.windSpeed, forecast.windGust)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">
                  <DirectionArrow degrees={forecast.windDirection} isFromDirection={true} className="text-amber-700" />
                </td>
                <td className="px-4 py-3 text-2xl text-center">
                  {getWeatherSymbol(forecast.symbolCode)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.precipitation ? formatValue(forecast.precipitation, 1, ' mm') : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 border-r-2 border-amber-200">
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.pressure !== undefined ? `${forecast.pressure.toFixed(0)} hPa` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-700 border-r-2 border-amber-200">
                  {forecast.uvIndex !== undefined ? (
                    <span className={
                      forecast.uvIndex >= 8
                        ? 'text-red-700 font-semibold'
                        : forecast.uvIndex >= 6
                          ? 'text-orange-700 font-semibold'
                          : forecast.uvIndex >= 3
                            ? 'text-amber-700 font-medium'
                            : 'text-gray-600'
                    }>
                      {Math.round(forecast.uvIndex)}
                    </span>
                  ) : '—'}
                </td>

                {/* ── Barentswatch Waveforecast cells ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-l-2 border-slate-300/50">
                    {forecast.waveHeight !== undefined
                      ? forecast.isInterpolatedWave
                        ? <span className="text-gray-400 italic">{forecast.waveHeight.toFixed(1)} m</span>
                        : <><strong>{forecast.waveHeight.toFixed(1)}</strong>{' m'}</>
                      : '—'}
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center">
                    {/* Wave direction: do NOT add 180° (show as-is) */}
                    <DirectionArrow degrees={forecast.waveDirection} isFromDirection={false} className={forecast.isInterpolatedWave ? 'text-gray-400' : 'text-maritime-teal-600'} />
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-r-2 border-slate-200">
                    {forecast.wavePeriod !== undefined
                      ? forecast.isInterpolatedWave
                        ? <span className="text-gray-400 italic">{forecast.wavePeriod.toFixed(1)} s</span>
                        : <>{forecast.wavePeriod.toFixed(1)}{' s'}</>
                      : '—'}
                  </td>
                )}
                {/* ── Barentswatch Sea Current cells ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-l-2 border-blue-300/50">
                    {forecast.currentSpeed !== undefined
                      ? <>{forecast.currentSpeed.toFixed(2)}{' m/s'}</>
                      : '—'}
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-r-2 border-blue-200">
                    {/* Current direction: to-direction */}
                    <DirectionArrow degrees={forecast.currentDirection} isFromDirection={false} className="text-blue-600" />
                  </td>
                )}
                {/* ── MET.no Oceanforecast Sea Temp cell ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-l-2 border-cyan-300/50 border-r-2 border-cyan-200">
                    {forecast.seaTemperature !== undefined
                      ? <>{forecast.seaTemperature.toFixed(1)}{'°C'}</>
                      : '—'}
                  </td>
                )}
                {/* ── Kartverket cell ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-purple-300/50 border-r-2 border-r-purple-200">
                    {forecast.tidePhase ?? '—'}
                  </td>
                )}
                {/* ── Calculated cell ── */}
                <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-yellow-200" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                  {forecast.sunPhase ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.moonPhase
                    ? <span role="img" aria-label={forecast.moonPhase.replace(/^\S+\s*/, '')}>{forecast.moonPhase}</span>
                    : '—'}
                </td>
                <td className="px-2 py-3 text-center">
                  {lat !== undefined && lng !== undefined && (
                    <FeedbackButton item={{
                      id: `details-${forecast.time}`,
                      page: 'Details',
                      time: formatTime(forecast.time),
                      lat,
                      lng,
                      locationName,
                      summary: [
                        forecast.windSpeed !== undefined ? `Wind ${forecast.windSpeed.toFixed(1)} m/s` : null,
                        forecast.waveHeight !== undefined ? `Waves ${forecast.waveHeight.toFixed(1)} m` : null,
                        forecast.temperature !== undefined ? `Temp ${forecast.temperature.toFixed(1)}°C` : null,
                      ].filter(Boolean).join(', ') || '—',
                    }} />
                  )}
                </td>
              </tr>
              );

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
