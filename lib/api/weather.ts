/**
 * MET.no Locationforecast API integration
 * Validates if weather data is available for a location
 */

import type {
  LocationForecastResponse,
  OceanForecastResponse,
  OceanForecastTimeseries,
  HourlyForecast,
} from '@/types/weather';

export interface WeatherValidationResult {
  available: boolean;
  locationName?: string;
  error?: string;
}

const USER_AGENT = 'NoFish/1.0 github.com/ChrVage/NoFish';

/**
 * Check if MET.no can provide weather forecast for the given coordinates
 * @param lat Latitude
 * @param lng Longitude
 * @returns Validation result indicating if weather data is available
 */
export async function validateWeatherLocation(
  lat: number,
  lng: number
): Promise<WeatherValidationResult> {
  try {
    // MET.no Locationforecast API
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?` +
        `lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      return {
        available: false,
        error: `MET.no API returned ${response.status}`,
      };
    }

    const data = await response.json();

    // Check if we got valid forecast data
    if (data.properties?.timeseries && data.properties.timeseries.length > 0) {
      return {
        available: true,
      };
    }

    return {
      available: false,
      error: 'No forecast data available for this location',
    };
  } catch (error) {
    console.error('Weather validation error:', error);
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Locationforecast data from MET.no
 * @param lat Latitude
 * @param lng Longitude
 * @returns Location forecast data
 */
export async function getLocationForecast(
  lat: number,
  lng: number
): Promise<LocationForecastResponse> {
  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?` +
        `lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Locationforecast API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Locationforecast fetch error:', error);
    throw error;
  }
}

/**
 * Fetch Oceanforecast data from MET.no
 * @param lat Latitude
 * @param lng Longitude
 * @returns Ocean forecast data
 */
export async function getOceanForecast(
  lat: number,
  lng: number
): Promise<OceanForecastResponse | null> {
  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/oceanforecast/2.0/complete?` +
        `lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      // Ocean forecast might not be available for all locations
      console.warn(`Oceanforecast API returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Oceanforecast fetch error:', error);
    // Don't throw - ocean data is optional
    return null;
  }
}

/**
 * Combine location and ocean forecast data into hourly forecast
 * @param locationForecast Location forecast data
 * @param oceanForecast Ocean forecast data (optional)
 * @returns Array of hourly forecasts
 */
export function combineForecasts(
  locationForecast: LocationForecastResponse,
  oceanForecast: OceanForecastResponse | null
): HourlyForecast[] {
  const hourlyForecasts: HourlyForecast[] = [];

  // Create a map of ocean data by time for quick lookup
  const oceanDataMap = new Map<string, OceanForecastTimeseries>();
  if (oceanForecast) {
    oceanForecast.properties.timeseries.forEach((entry) => {
      oceanDataMap.set(entry.time, entry);
    });
  }

  // Process location forecast timeseries
  locationForecast.properties.timeseries.forEach((entry) => {
    const oceanData = oceanDataMap.get(entry.time);

    const hourlyForecast: HourlyForecast = {
      time: entry.time,
      temperature: entry.data.instant.details.air_temperature,
      windSpeed: entry.data.instant.details.wind_speed,
      windDirection: entry.data.instant.details.wind_from_direction,
      humidity: entry.data.instant.details.relative_humidity,
      cloudCover: entry.data.instant.details.cloud_area_fraction,
      pressure: entry.data.instant.details.air_pressure_at_sea_level,
      precipitation: entry.data.next_1_hours?.details.precipitation_amount,
      symbolCode: entry.data.next_1_hours?.summary.symbol_code || 
                  entry.data.next_6_hours?.summary.symbol_code,
    };

    // Add ocean data if available
    if (oceanData) {
      hourlyForecast.waveHeight = oceanData.data.instant.details.sea_surface_wave_height;
      hourlyForecast.waveDirection = oceanData.data.instant.details.sea_surface_wave_from_direction;
      hourlyForecast.seaTemperature = oceanData.data.instant.details.sea_water_temperature;
      hourlyForecast.currentSpeed = oceanData.data.instant.details.sea_water_speed;
      hourlyForecast.currentDirection = oceanData.data.instant.details.sea_water_to_direction;
    }

    hourlyForecasts.push(hourlyForecast);
  });

  return hourlyForecasts;
}

/**
 * Fetch combined weather and ocean forecast for a location
 * @param lat Latitude
 * @param lng Longitude
 * @returns Array of hourly forecasts
 */
export async function getCombinedForecast(
  lat: number,
  lng: number
): Promise<HourlyForecast[]> {
  try {
    // Fetch both forecasts in parallel
    const [locationForecast, oceanForecast] = await Promise.all([
      getLocationForecast(lat, lng),
      getOceanForecast(lat, lng),
    ]);

    return combineForecasts(locationForecast, oceanForecast);
  } catch (error) {
    console.error('Combined forecast error:', error);
    throw error;
  }
}
