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
  if (degrees === undefined) return <span>—</span>;
  
  // If it's a "from" direction, add 180° to point toward where it's going
  const displayDegrees = isFromDirection ? (degrees + 180) % 360 : degrees;
  
  return (
    <svg
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

// ── Accuracy colour helpers (inline styles – safe from Tailwind purging) ────────
// MET Norway Locationforecast: excellent ≤3 days · good 3–5 days · fair >5 days
function getLocStyle(daysAhead: number): React.CSSProperties {
  if (daysAhead <= 3) return { backgroundColor: '#f0fdf4' }; // green-50
  if (daysAhead <= 5) return { backgroundColor: '#fffbeb' }; // amber-50
  return { backgroundColor: '#fff7ed' };                     // orange-50
}

// MET Norway Oceanforecast: good ≤2 days · fair 2–4 days · degrading >4 days
function getOceanStyle(daysAhead: number): React.CSSProperties {
  if (daysAhead <= 2) return { backgroundColor: '#f0fdf4' }; // green-50
  if (daysAhead <= 4) return { backgroundColor: '#f0f9ff' }; // sky-50
  return { backgroundColor: '#fff7ed' };                     // orange-50
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
    if (speed === undefined) return '—';
    const gustPart = gust !== undefined ? ` (${gust.toFixed(1)})` : '';
    return `${speed.toFixed(1)}${gustPart} m/s`;
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
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-ocean-700 text-white">
            {/* API source group header row */}
            <tr className="bg-ocean-800 text-ocean-200 text-[10px] uppercase tracking-widest">
              <th className="sticky left-0 bg-ocean-800 z-10" />
              {/* MET Norway Locationforecast — always present */}
              <th
                colSpan={5}
                className="px-4 py-1 text-center font-semibold border-l-2 border-amber-400/50 border-r border-amber-400/20"
              >
                MET Norway Locationforecast
              </th>
              {/* MET Norway Oceanforecast — coastal only */}
              {hasOceanData && (
                <th
                  colSpan={5}
                  className="px-4 py-1 text-center font-semibold border-l border-ocean-400/20 border-r border-ocean-400/20"
                >
                  MET Norway Oceanforecast
                </th>
              )}
              {/* Kartverket — astronomical tides */}
              {hasOceanData && (
                <th
                  colSpan={1}
                  className="px-4 py-1 text-center font-semibold border-l border-purple-400/20 border-r border-purple-400/20"
                >
                  Kartverket
                </th>
              )}
              {/* Calculated */}
              <th
                colSpan={1}
                className="px-4 py-1 text-center font-semibold border-l border-yellow-400/20"
              >
                Calculated
              </th>
            </tr>

            {/* Column header row */}
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider sticky left-0 bg-ocean-700 z-10">
                Time
              </th>

              {/* ── MET Norway Locationforecast columns ── */}
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-amber-900/20 border-l-2 border-amber-400/50">
                Weather
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20">
                Wind
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-amber-900/20">
                Wind Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20">
                Precip.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20 border-r-2 border-amber-400/30">
                Air Temp
              </th>

              {/* ── MET Norway Oceanforecast columns ── */}
              {hasOceanData && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-ocean-800/30 border-l-2 border-ocean-400/50">
                  Wave Height
                </th>
              )}
              {hasOceanData && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-ocean-800/30">
                  Wave Dir
                </th>
              )}
              {hasOceanData && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-ocean-800/30">
                  Sea Temp
                </th>
              )}
              {hasOceanData && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-ocean-800/30">
                  Current
                </th>
              )}
              {hasOceanData && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-ocean-800/30 border-r-2 border-ocean-400/30">
                  Current Dir
                </th>
              )}

              {/* ── Kartverket column ── */}
              {hasOceanData && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-purple-900/20 border-l-2 border-purple-400/50 border-r-2 border-r-purple-400/30">
                  Tide
                </th>
              )}

              {/* ── Calculated column ── */}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-yellow-900/20 border-l-2 border-yellow-400/50">
                Sun
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {forecasts.map((forecast, index) => {
              const daysAhead = (new Date(forecast.time).getTime() - now) / 86_400_000;
              const locStyle = getLocStyle(daysAhead);
              const oceanStyle = getOceanStyle(daysAhead);
              return (
              <tr
                key={forecast.time}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 z-10 bg-inherit">
                  {formatTime(forecast.time)}
                </td>

                {/* ── MET Norway Locationforecast cells ── */}
                <td className="px-4 py-3 text-2xl text-center border-l-2 border-amber-300/50" style={locStyle}>
                  <span title={forecast.symbolCode}>
                    {getWeatherSymbol(forecast.symbolCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700" style={locStyle}>
                  {formatWind(forecast.windSpeed, forecast.windGust)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center" style={locStyle}>
                  <DirectionArrow degrees={forecast.windDirection} isFromDirection={true} className="text-amber-700" />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700" style={locStyle}>
                  {formatValue(forecast.precipitation, 1, ' mm')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 border-r-2 border-amber-200" style={locStyle}>
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>

                {/* ── MET Norway Oceanforecast cells ── */}
                {hasOceanData && (
                  <td className="px-4 py-3 text-sm text-gray-700 text-center border-l-2 border-ocean-300/50" style={oceanStyle}>
                    {formatValue(forecast.waveHeight, 1, ' m')}
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
                <td className="px-4 py-3 text-sm text-gray-700 border-l-2 border-yellow-200" style={{ backgroundColor: '#f0fdf4' }}>
                  {forecast.sunPhase || '—'}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
