/**
 * MET.no Locationforecast API integration
 * Validates if weather data is available for a location
 */

import type {
  LocationForecastResponse,
  OceanForecastResponse,
  OceanForecastTimeseries,
  TideForecastResponse,
  TideForecastTimeseries,
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
 * Fetch Tide forecast data from Kartverket API
 * @param lat Latitude
 * @param lng Longitude
 * @returns Tide forecast data or null if unavailable
 */
export async function getTideForecast(
  lat: number,
  lng: number
): Promise<TideForecastResponse | null> {
  try {
    const fromTime = new Date();
    const toTime = new Date(fromTime.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead
    
    // Format dates as ISO strings for the API
    const fromTimeStr = fromTime.toISOString();
    const toTimeStr = toTime.toISOString();
    
    const url = `https://vannstand.kartverket.no/tideapi.php?` +
        `lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}` +
        `&fromtime=${fromTimeStr}&totime=${toTimeStr}` +
        `&datatype=all&refcode=cd&place=&file=&lang=en&interval=60&dst=0&tzone=&tide_request=locationdata`;
    
    console.log('🌊 Fetching tide data from:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    console.log('🌊 Tide API response status:', response.status);

    if (!response.ok) {
      console.warn(`❌ Kartverket Tide API returned ${response.status}`);
      return generateSampleTideData(lat, lng, fromTime, toTime);
    }

    const text = await response.text();
    console.log('🌊 Tide API response (first 200 chars):', text.substring(0, 200));
    
    const parsed = parseTideTabFormat(text, lat, lng);
    console.log('✅ Successfully parsed tide data:', parsed.properties.timeseries.length, 'entries');
    return parsed;
  } catch (error) {
    console.error('❌ Tide API error:', error);
    // Generate sample data as fallback
    const fromTime = new Date();
    const toTime = new Date(fromTime.getTime() + 10 * 24 * 60 * 60 * 1000);
    return generateSampleTideData(lat, lng, fromTime, toTime);
  }
}

/**
 * Combine location, ocean, and tide forecast data into hourly forecast
 * @param locationForecast Location forecast data
 * @param oceanForecast Ocean forecast data (optional)
 * @param tideForecast Tide forecast data (optional)
 * @returns Array of hourly forecasts
 */
export function combineForecasts(
  locationForecast: LocationForecastResponse,
  oceanForecast: OceanForecastResponse | null,
  tideForecast: TideForecastResponse | null
): HourlyForecast[] {
  const hourlyForecasts: HourlyForecast[] = [];

  // Create a map of ocean data by time for quick lookup
  const oceanDataMap = new Map<string, OceanForecastTimeseries>();
  if (oceanForecast) {
    oceanForecast.properties.timeseries.forEach((entry) => {
      oceanDataMap.set(entry.time, entry);
    });
  }

  // Create a map of tide data by hour for quick lookup
  const tideDataMap = new Map<string, TideForecastTimeseries>();
  if (tideForecast) {
    tideForecast.properties.timeseries.forEach((entry) => {
      // Round time to nearest hour for matching
      const entryDate = new Date(entry.time);
      const hourKey = new Date(
        entryDate.getFullYear(),
        entryDate.getMonth(),
        entryDate.getDate(),
        entryDate.getHours()
      ).toISOString();
      tideDataMap.set(hourKey, entry);
    });
  }

  // Process location forecast timeseries
  locationForecast.properties.timeseries.forEach((entry) => {
    const oceanData = oceanDataMap.get(entry.time);
    
    // Find tide data for this hour
    const entryDate = new Date(entry.time);
    const hourKey = new Date(
      entryDate.getFullYear(),
      entryDate.getMonth(),
      entryDate.getDate(),
      entryDate.getHours()
    ).toISOString();
    const tideData = tideDataMap.get(hourKey);

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

    // Add tide data if available
    if (tideData) {
      hourlyForecast.tideHeight = tideData.data.instant.details.sea_surface_height_above_chart_datum;
    }

    hourlyForecasts.push(hourlyForecast);
  });

  return hourlyForecasts;
}

/**
 * Parse tab-separated tide data from Kartverket API
 */
function parseTideTabFormat(
  text: string,
  lat: number,
  lng: number
): TideForecastResponse {
  const lines = text.trim().split('\n');
  const timeseries: TideForecastTimeseries[] = [];
  
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('time') || !line.trim()) {
      continue;
    }
    
    const parts = line.split('\t');
    if (parts.length >= 2) {
      const timeStr = parts[0].trim();
      try {
        const value = parseFloat(parts[1].trim());
        timeseries.push({
          time: timeStr,
          data: {
            instant: {
              details: {
                sea_surface_height_above_chart_datum: value
              }
            }
          }
        });
      } catch {
        continue;
      }
    }
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    properties: {
      meta: {
        updated_at: new Date().toISOString(),
        station_name: 'Kartverket Station',
        station_code: 'AUTO',
        units: {
          sea_surface_height_above_chart_datum: 'cm'
        }
      },
      timeseries
    }
  };
}

/**
 * Generate sample tide data using semi-diurnal tidal model
 */
function generateSampleTideData(
  lat: number,
  lng: number,
  fromTime: Date,
  toTime: Date
): TideForecastResponse {
  const timeseries: TideForecastTimeseries[] = [];
  const tidalPeriodHours = 12.42; // Semi-diurnal tide period
  const meanHighWater = 150; // cm
  const meanLowWater = 50; // cm
  const tidalRange = meanHighWater - meanLowWater;
  const meanTide = (meanHighWater + meanLowWater) / 2;
  
  let currentTime = new Date(fromTime);
  const interval = 60 * 60 * 1000; // 1 hour in milliseconds
  
  while (currentTime <= toTime) {
    const hoursElapsed = (currentTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60);
    
    // Primary semi-diurnal component (M2)
    const tideM2 = Math.sin(2 * Math.PI * hoursElapsed / tidalPeriodHours);
    
    // Secondary component (S2 - solar semi-diurnal)
    const tideS2 = 0.3 * Math.sin(2 * Math.PI * hoursElapsed / 12.0);
    
    // Combine components and scale
    const tideHeight = meanTide + (tidalRange / 2) * (tideM2 + tideS2);
    
    timeseries.push({
      time: currentTime.toISOString(),
      data: {
        instant: {
          details: {
            sea_surface_height_above_chart_datum: Math.round(tideHeight * 10) / 10
          }
        }
      }
    });
    
    currentTime = new Date(currentTime.getTime() + interval);
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat]
    },
    properties: {
      meta: {
        updated_at: new Date().toISOString(),
        station_name: 'Sample Data (API Unavailable)',
        station_code: 'SAMPLE',
        units: {
          sea_surface_height_above_chart_datum: 'cm'
        }
      },
      timeseries
    }
  };
}

/**
 * Fetch combined weather, ocean, and tide forecast for a location
 * @param lat Latitude
 * @param lng Longitude
 * @returns Array of hourly forecasts with metadata
 */
export async function getCombinedForecast(
  lat: number,
  lng: number
): Promise<{
  forecasts: HourlyForecast[];
  metadata: {
    tideDataSource: 'real' | 'sample';
    tideDataMessage?: string;
  };
}> {
  try {
    // Fetch all forecasts in parallel
    const [locationForecast, oceanForecast, tideForecast] = await Promise.all([
      getLocationForecast(lat, lng),
      getOceanForecast(lat, lng),
      getTideForecast(lat, lng),
    ]);

    // Check if tide data is sample or real
    const tideDataSource = tideForecast?.properties.meta.station_code === 'SAMPLE' ? 'sample' : 'real';
    const tideDataMessage = tideDataSource === 'sample' 
      ? 'Using simulated tide data (Kartverket API unavailable)'
      : undefined;

    return {
      forecasts: combineForecasts(locationForecast, oceanForecast, tideForecast),
      metadata: {
        tideDataSource,
        tideDataMessage,
      },
    };
  } catch (error) {
    console.error('Combined forecast error:', error);
    throw error;
  }
}
