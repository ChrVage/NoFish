'use client';

import React from 'react';
import type { HourlyForecast } from '@/types/weather';

interface ForecastTableProps {
  forecasts: HourlyForecast[];
  timezone: string;
}

// Weather symbol mapping (MET Norway symbol codes)
const getWeatherSymbol = (symbolCode: string | undefined) => {
  if (!symbolCode) return '❓';
  
  const code = symbolCode.toLowerCase();
  if (code.includes('clearsky')) return '☀️';
  if (code.includes('fair')) return '🌤️';
  if (code.includes('partlycloudy')) return '⛅';
  if (code.includes('cloudy')) return '☁️';
  if (code.includes('lightrain') || code.includes('rainshowers')) return '🌦️';
  if (code.includes('rain')) return '🌧️';
  if (code.includes('heavyrain')) return '⛈️';
  if (code.includes('sleet')) return '🌨️';
  if (code.includes('snow')) return '❄️';
  if (code.includes('fog')) return '🌫️';
  if (code.includes('thunder')) return '⚡';
  return '🌥️';
};

const getWeatherLabel = (symbolCode: string | undefined): string => {
  if (!symbolCode) return 'Unknown weather';
  const code = symbolCode.toLowerCase();
  if (code.includes('clearsky')) return 'Clear sky';
  if (code.includes('fair')) return 'Fair';
  if (code.includes('partlycloudy')) return 'Partly cloudy';
  if (code.includes('cloudy')) return 'Cloudy';
  if (code.includes('lightrain') || code.includes('rainshowers')) return 'Light rain';
  if (code.includes('heavyrain')) return 'Heavy rain';
  if (code.includes('rain')) return 'Rain';
  if (code.includes('sleet')) return 'Sleet';
  if (code.includes('snow')) return 'Snow';
  if (code.includes('fog')) return 'Fog';
  if (code.includes('thunder')) return 'Thunder';
  return 'Cloudy';
};

// Arrow component for direction visualization
// For "from" directions (wind, waves), adds 180° to point toward where it's going
// For "to" directions (current), uses the value as-is
const DirectionArrow = ({ 
  degrees, 
  isFromDirection = false,
  className = '' 
}: { 
  degrees: number | undefined; 
  isFromDirection?: boolean;
  className?: string 
}) => {
  if (degrees === undefined) return <span aria-hidden="true">—</span>;
  
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const cardinal = cardinals[Math.round(degrees / 45) % 8];
  const label = isFromDirection ? `From ${cardinal}` : `To ${cardinal}`;

  // If it's a "from" direction, add 180° to point toward where it's going
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

// ── Sun-phase background colour for the Time column ────────────────────────────
const sunPhaseColors: Record<string, [number, number, number]> = {
  day:       [255, 255, 255], // white
  civil:     [190, 195, 210], // light grey-blue
  nautical:  [30,  50,  90],  // dark blue
  night:     [0,   0,   0],   // black
};

function getTimeColumnStyle(
  segments: { phase: string; fraction: number }[] | undefined,
): React.CSSProperties {
  if (!segments || segments.length === 0) return {};

  // Blend RGB weighted by fraction
  let r = 0, g = 0, b = 0;
  for (const seg of segments) {
    const c = sunPhaseColors[seg.phase] ?? [128, 128, 128];
    r += c[0] * seg.fraction;
    g += c[1] * seg.fraction;
    b += c[2] * seg.fraction;
  }
  r = Math.round(r);
  g = Math.round(g);
  b = Math.round(b);

  // Use white text when the background is dark
  const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
  const textColor = luminance < 140 ? '#ffffff' : '#111827';

  return { backgroundColor: `rgb(${r}, ${g}, ${b})`, color: textColor };
}

// ── Accuracy colour helpers (inline styles – safe from Tailwind purging) ────────
// Three confidence tiers: High (green) · Medium (amber) · Low (orange)
// MET Norway Locationforecast: high ≤3 days · medium 3–5 days · low >5 days
function getLocStyle(daysAhead: number): React.CSSProperties {
  if (daysAhead <= 3) return { backgroundColor: '#f0fdf4' }; // green-50  — High
  if (daysAhead <= 5) return { backgroundColor: '#fffbeb' }; // amber-50  — Medium
  return { backgroundColor: '#fed7aa' };                     // orange-200 — Low
}

// MET Norway Oceanforecast: high ≤2 days · medium 2–4 days · low >4 days
function getOceanStyle(daysAhead: number): React.CSSProperties {
  if (daysAhead <= 2) return { backgroundColor: '#f0fdf4' }; // green-50  — High
  if (daysAhead <= 4) return { backgroundColor: '#fffbeb' }; // amber-50  — Medium
  return { backgroundColor: '#fed7aa' };                     // orange-200 — Low
}

export default function ForecastTable({ forecasts, timezone }: ForecastTableProps) {
  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No forecast data available</p>
      </div>
    );
  }

  // If no row has wave data the point is inland — hide ocean-specific columns
  const hasOceanData = forecasts.some(f => f.waveHeight !== undefined);
  const precipLabel = (forecasts[0]?.temperature ?? 2) > 1 ? 'Rain' : 'Snow';

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

  const formatValue = (value: number | undefined, decimals: number = 1, unit: string = '') => {
    if (value === undefined || value === null) return '—';
    return `${value.toFixed(decimals)}${unit}`;
  };

  // Format wind as "10.5 (15.0) m/s" where (15.0) is the gust
  const formatWind = (speed: number | undefined, gust: number | undefined) => {
    if (speed === undefined) return <span>—</span>;
    const gustPart = gust !== undefined
      ? <> ({gust.toFixed(1)})</>
      : null;
    return <><strong>{speed.toFixed(1)}</strong>{gustPart}{' m/s'}</>;
  };

  const getDirectionLabel = (degrees: number | undefined, isToDirection: boolean = false) => {
    if (degrees === undefined) return '—';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    const direction = directions[index];
    return isToDirection ? `to ${direction}` : direction;
  };

  const now = Date.now();

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200" aria-label="Hourly weather forecast">
          <thead className="bg-ocean-700 text-white">
            {/* API source group header row */}
            <tr className="bg-ocean-800 text-ocean-200 text-[10px] tracking-widest">
              <th className="sticky left-0 bg-ocean-800 z-10" aria-hidden="true" />
              {/* MET Norway Locationforecast — always present */}
              <th
                colSpan={5}
                scope="colgroup"
                className="px-4 py-1 text-center font-semibold border-l-2 border-amber-400/50 border-r border-amber-400/20"
              >
                MET Norway Locationforecast
              </th>
              {/* MET Norway Oceanforecast — coastal only */}
              {hasOceanData && (
                <th
                  colSpan={5}
                  scope="colgroup"
                  className="px-4 py-1 text-center font-semibold border-l border-ocean-400/20 border-r border-ocean-400/20"
                >
                  MET Norway Oceanforecast
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
                colSpan={1}
                scope="colgroup"
                className="px-4 py-1 text-center font-semibold border-l border-yellow-400/20"
              >
                Calculated
              </th>
            </tr>

            {/* Column header row */}
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider sticky left-0 bg-ocean-700 z-10">
                Time
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
                Air Temp
              </th>

              {/* ── MET Norway Oceanforecast columns ── */}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-ocean-800/30 border-l-2 border-ocean-400/50">
                  Wave Height
                </th>
              )}
              {hasOceanData && (
                <th scope="col" aria-label="Wave direction" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-ocean-800/30">
                </th>
              )}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-ocean-800/30">
                  Sea Temp
                </th>
              )}
              {hasOceanData && (
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium tracking-wider bg-ocean-800/30">
                  Current
                </th>
              )}
              {hasOceanData && (
                <th scope="col" aria-label="Current direction" className="px-4 py-3 text-center text-xs font-medium tracking-wider bg-ocean-800/30 border-r-2 border-ocean-400/30">
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
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {forecasts.map((forecast, index) => {
              const daysAhead = (new Date(forecast.time).getTime() - now) / 86_400_000;
              const locStyle = getLocStyle(daysAhead);
              const oceanStyle = getOceanStyle(daysAhead);

              // Detect the last hourly row (gap to next row jumps from ~1 h to ~6 h)
              const isLastHourly = index < forecasts.length - 1 && (() => {
                const thisGap = new Date(forecasts[index + 1].time).getTime() - new Date(forecast.time).getTime();
                const prevGap = index > 0
                  ? new Date(forecast.time).getTime() - new Date(forecasts[index - 1].time).getTime()
                  : thisGap;
                return prevGap <= 90 * 60_000 && thisGap > 90 * 60_000;
              })();

              // Detect midnight boundary (local date changed since previous row)
              const isMidnight = index > 0 && !isLastHourly && (() => {
                const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
                return dateFmt.format(new Date(forecast.time)) !== dateFmt.format(new Date(forecasts[index - 1].time));
              })();

              // Count total columns for separator rows
              const totalCols = 6 + (hasOceanData ? 6 : 0) + 1;

              const rows: React.ReactNode[] = [];

              // Insert a thin separator row before midnight rows
              if (isMidnight) {
                rows.push(
                  <tr key={`midnight-${forecast.time}`} aria-hidden="true">
                    <td colSpan={totalCols} style={{ height: '3px', padding: 0, backgroundColor: '#d1d5db' }} />
                  </tr>
                );
              }

              rows.push(
              <tr
                key={forecast.time}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                style={isLastHourly ? { boxShadow: '0 3px 0 -1px #9ca3af, 0 6px 0 -1px #9ca3af' } : undefined}
              >
                <td
                  className="px-4 py-3 text-sm font-medium sticky left-0 z-10"
                  style={getTimeColumnStyle(forecast.sunPhaseSegments)}
                >
                  {formatTime(forecast.time)}
                </td>

                {/* ── MET Norway Locationforecast cells ── */}
                <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-amber-300/50" style={locStyle}>
                  {formatWind(forecast.windSpeed, forecast.windGust)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center" style={locStyle}>
                  <DirectionArrow degrees={forecast.windDirection} isFromDirection={true} className="text-amber-700" />
                </td>
                <td className="px-4 py-3 text-2xl text-center" style={locStyle}>
                  <span role="img" aria-label={getWeatherLabel(forecast.symbolCode)}>
                    {getWeatherSymbol(forecast.symbolCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700" style={locStyle}>
                  {forecast.precipitation ? formatValue(forecast.precipitation, 1, ' mm') : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 border-r-2 border-amber-200" style={locStyle}>
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>

                {/* ── MET Norway Oceanforecast cells ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-l-2 border-ocean-300/50" style={oceanStyle}>
                    {forecast.waveHeight !== undefined
                      ? <><strong>{forecast.waveHeight.toFixed(1)}</strong>{' m'}</>
                      : '—'}
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center" style={oceanStyle}>
                    <DirectionArrow degrees={forecast.waveDirection} isFromDirection={true} className="text-ocean-600" />
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700" style={oceanStyle}>
                    {formatValue(forecast.seaTemperature, 1, '°C')}
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700" style={oceanStyle}>
                    {formatValue(forecast.currentSpeed, 2, ' m/s')}
                  </td>
                )}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-r-2 border-ocean-200" style={oceanStyle}>
                    <DirectionArrow degrees={forecast.currentDirection} className="text-teal-600" />
                  </td>
                )}

                {/* ── Kartverket cell ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-purple-300/50 border-r-2 border-r-purple-200" style={{ backgroundColor: '#f0fdf4' }}>
                    {forecast.tidePhase || '—'}
                  </td>
                )}

                {/* ── Calculated cell ── */}
                <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-yellow-200" style={getTimeColumnStyle(forecast.sunPhaseSegments)}>
                  {forecast.sunPhase || '—'}
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
