'use client';

import type { HourlyForecast } from '@/types/weather';

interface ForecastTableProps {
  forecasts: HourlyForecast[];
}

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
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Wind
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Precip.
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Humidity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Clouds
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Waves
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Sea Temp
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Current
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
                  {formatValue(forecast.temperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.windSpeed !== undefined ? (
                    <div>
                      <div>{formatValue(forecast.windSpeed, 1, ' m/s')}</div>
                      <div className="text-xs text-gray-500">
                        {getDirectionLabel(forecast.windDirection)}
                      </div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.precipitation, 1, ' mm')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.humidity, 0, '%')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.cloudCover, 0, '%')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.waveHeight !== undefined ? (
                    <div>
                      <div>{formatValue(forecast.waveHeight, 1, ' m')}</div>
                      <div className="text-xs text-gray-500">
                        {getDirectionLabel(forecast.waveDirection)}
                      </div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {formatValue(forecast.seaTemperature, 1, '°C')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {forecast.currentSpeed !== undefined ? (
                    <div>
                      <div>{formatValue(forecast.currentSpeed, 2, ' m/s')}</div>
                      <div className="text-xs text-gray-500">
                        {getDirectionLabel(forecast.currentDirection, true)}
                      </div>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
