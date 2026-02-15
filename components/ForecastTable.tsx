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
const DirectionArrow = ({ degrees, className = '' }: { degrees: number | undefined; className?: string }) => {
  if (degrees === undefined) return <span>—</span>;
  
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`inline-block ${className}`}
      style={{ transform: `rotate(${degrees}deg)` }}
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
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatValue = (value: number | undefined, decimals: number = 1, unit: string = '') => {
    if (value === undefined || value === null) return '—';
    return `${value.toFixed(decimals)}${unit}`;
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
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Weather
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Air Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Wind
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Wind Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Precip.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Wave Height
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Wave Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Sea Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Current
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Current Dir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Tide
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
                <td className="px-4 py-3 text-2xl text-center">
                  <span title={forecast.symbolCode}>
                    {getWeatherSymbol(forecast.symbolCode)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.windSpeed, 1, ' m/s')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">
                  <DirectionArrow degrees={forecast.windDirection} className="text-blue-600" />
                  <div className="text-xs text-gray-500">
                    {getDirectionLabel(forecast.windDirection)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.precipitation, 1, ' mm')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.waveHeight, 1, ' m')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">
                  <DirectionArrow degrees={forecast.waveDirection} className="text-ocean-600" />
                  <div className="text-xs text-gray-500">
                    {getDirectionLabel(forecast.waveDirection)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.seaTemperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.currentSpeed, 2, ' m/s')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-center">
                  <DirectionArrow degrees={forecast.currentDirection} className="text-teal-600" />
                  <div className="text-xs text-gray-500">
                    {getDirectionLabel(forecast.currentDirection, true)}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.tideHeight, 0, ' cm')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
