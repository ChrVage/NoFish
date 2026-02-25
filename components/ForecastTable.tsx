'use client';

import type { HourlyForecast } from '@/types/weather';

interface ForecastTableProps {
  forecasts: HourlyForecast[];
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

export default function ForecastTable({ forecasts }: ForecastTableProps) {
  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <p className="text-gray-600">No forecast data available</p>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    // Format for Norway timezone (Europe/Oslo)
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Oslo'
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

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-ocean-700 text-white">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider sticky left-0 bg-ocean-700 z-10">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Tide
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-blue-900/20 border-l-2 border-blue-400/30">
                Wind
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-blue-900/20 border-r-2 border-blue-400/30">
                Wind Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-ocean-800/30 border-l-2 border-ocean-400/30">
                Wave Height
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-ocean-800/30 border-r-2 border-ocean-400/30">
                Wave Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-yellow-900/20 border-l-2 border-yellow-400/30 border-r-2">
                Sun
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-teal-900/20 border-l-2 border-teal-400/30">
                Current
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-teal-900/20 border-r-2 border-teal-400/30">
                Current Dir
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider bg-amber-900/20 border-l-2 border-amber-400/30">
                Weather
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20">
                Precip.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20">
                Air Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-amber-900/20 border-r-2 border-amber-400/30">
                Sea Temp
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {forecasts.map((forecast, index) => (
              <tr
                key={forecast.time}
                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 z-10 bg-inherit">
                  {formatTime(forecast.time)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.tidePhase || '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-blue-50/50 border-l-2 border-blue-200">
                  {formatWind(forecast.windSpeed, forecast.windGust)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center bg-blue-50/50 border-r-2 border-blue-200">
                  <DirectionArrow degrees={forecast.windDirection} isFromDirection={true} className="text-blue-600" />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-ocean-50/50 border-l-2 border-ocean-200">
                  {formatValue(forecast.waveHeight, 1, ' m')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center bg-ocean-50/50 border-r-2 border-ocean-200">
                  <DirectionArrow degrees={forecast.waveDirection} isFromDirection={true} className="text-ocean-600" />
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-yellow-50/50 border-l-2 border-yellow-200 border-r-2">
                  {forecast.sunPhase || '\u2014'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-teal-50/50 border-l-2 border-teal-200">
                  {formatValue(forecast.currentSpeed, 2, ' m/s')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center bg-teal-50/50 border-r-2 border-teal-200">
                  <DirectionArrow degrees={forecast.currentDirection} className="text-teal-600" />
                </td>
                <td className="px-4 py-3 text-2xl text-center bg-amber-50/50 border-l-2 border-amber-200">
                  <span title={forecast.symbolCode}>
                    {getWeatherSymbol(forecast.symbolCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-amber-50/50">
                  {formatValue(forecast.precipitation, 1, ' mm')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-amber-50/50">
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 bg-amber-50/50 border-r-2 border-amber-200">
                  {formatValue(forecast.seaTemperature, 1, '°C')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
