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
  TideEvent,
  TideXMLResponse,
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
 * Fetch Tide forecast data from Kartverket API (XML format with high/low tide events)
 * @param lat Latitude
 * @param lng Longitude
 * @returns Tide events (high/low) or null if unavailable
 */
export async function getTideForecast(
  lat: number,
  lng: number
): Promise<TideXMLResponse | null> {
  try {
    const fromTime = new Date();
    const toTime = new Date(fromTime.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead
    
    // Format dates for the API (URL encoded)
    const fromTimeStr = fromTime.toISOString().replace(/\.\d{3}Z$/, ''); // Remove milliseconds
    const toTimeStr = toTime.toISOString().replace(/\.\d{3}Z$/, '');
    
    const url = `https://vannstand.kartverket.no/tideapi.php?` +
        `lat=${lat.toFixed(0)}&lon=${lng.toFixed(0)}` +
        `&fromtime=${encodeURIComponent(fromTimeStr)}&totime=${encodeURIComponent(toTimeStr)}` +
        `&datatype=tab&refcode=cd&lang=en&tide_request=locationdata`;
    
    console.log('🌊 Fetching tide data from:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    console.log('🌊 Tide API response status:', response.status);

    if (!response.ok) {
      console.warn(`❌ Kartverket Tide API returned ${response.status}`);
      return null;
    }

    const text = await response.text();
    console.log('🌊 Tide API response (first 500 chars):', text.substring(0, 500));
    
    // Parse XML to extract high/low tide events
    const parsed = parseTideXML(text, lat, lng);
    console.log('✅ Successfully parsed tide events:', parsed.events.length, 'events');
    return parsed;
  } catch (error) {
    console.error('❌ Tide API error:', error);
    return null;
  }
}

/**
 * Combine location, ocean, and tide forecast data into hourly forecast
 * @param locationForecast Location forecast data
 * @param oceanForecast Ocean forecast data (optional)
 * @param tideForecast Tide forecast data with high/low events (optional)
 * @returns Array of hourly forecasts
 */
export function combineForecasts(
  locationForecast: LocationForecastResponse,
  oceanForecast: OceanForecastResponse | null,
  tideForecast: TideXMLResponse | null
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
    
    const entryDate = new Date(entry.time);

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

    // Add tide phase if tide data is available
    if (tideForecast && tideForecast.events.length > 0) {
      hourlyForecast.tidePhase = calculateTidePhase(entryDate, tideForecast.events);
    }

    hourlyForecasts.push(hourlyForecast);
  });

  return hourlyForecasts;
}

/**
 * Parse XML tide data from Kartverket API to extract high/low tide events
 */
function parseTideXML(
  xmlText: string,
  lat: number,
  lng: number
): TideXMLResponse {
  const events: TideEvent[] = [];
  let stationName: string | undefined;
  
  // Simple XML parsing using regex (for production, consider using a proper XML parser)
  // Extract location name
  const locationMatch = xmlText.match(/<location[^>]+name="([^"]+)"/);
  if (locationMatch) {
    stationName = locationMatch[1];
  }
  
  // Extract waterlevel elements with high/low flags
  const waterLevelRegex = /<waterlevel\s+value="([\d.]+)"\s+time="([^"]+)"\s+flag="(high|low)"\/>/g;
  let match;
  
  while ((match = waterLevelRegex.exec(xmlText)) !== null) {
    const value = parseFloat(match[1]);
    const time = match[2];
    const flag = match[3] as 'high' | 'low';
    
    events.push({
      time,
      value,
      flag
    });
  }
  
  return {
    events,
    stationName,
    latitude: lat,
    longitude: lng
  };
}

/**
 * Calculate tide phase for a given hour based on high/low tide events
 * Example phases: "Hi (13:18)", "Hi+1", "Hi+2", "Falling", "Lo-2", "Lo-1", "Lo (19:18)", "Rising"
 */
function calculateTidePhase(hourTime: Date, tideEvents: TideEvent[]): string {
  if (!tideEvents || tideEvents.length === 0) {
    return '—';
  }
  
  // Normalize hourTime to the start of the hour
  const currentHour = new Date(
    hourTime.getFullYear(),
    hourTime.getMonth(),
    hourTime.getDate(),
    hourTime.getHours()
  );
  
  // Find the previous and next tide events relative to this hour
  let prevEvent: TideEvent | null = null;
  let nextEvent: TideEvent | null = null;
  
  for (let i = 0; i < tideEvents.length; i++) {
    const eventTime = new Date(tideEvents[i].time);
    
    if (eventTime < currentHour) {
      prevEvent = tideEvents[i];
    } else if (eventTime >= currentHour && !nextEvent) {
      nextEvent = tideEvents[i];
      break;
    }
  }
  
  // Handle case where we're before the first event (backward calculation)
  if (!prevEvent && nextEvent) {
    const nextEventTime = new Date(nextEvent.time);
    const nextEventHour = new Date(
      nextEventTime.getFullYear(),
      nextEventTime.getMonth(),
      nextEventTime.getDate(),
      nextEventTime.getHours()
    );
    
    // Check if the current hour contains the next event
    if (currentHour.getTime() === nextEventHour.getTime()) {
      const timeStr = formatTimeForPhase(nextEventTime);
      return nextEvent.flag === 'high' ? `Hi (${timeStr})` : `Lo (${timeStr})`;
    }
    
    const hoursBeforeNextEventHour = Math.round((nextEventHour.getTime() - currentHour.getTime()) / (1000 * 60 * 60));
    
    // If next event is high tide, we're in Rising phase approaching it
    if (nextEvent.flag === 'high') {
      if (hoursBeforeNextEventHour === 1) return 'Hi-1';
      if (hoursBeforeNextEventHour === 2) return 'Hi-2';
      return 'Rising';
    } else {
      // If next event is low tide, we're in Falling phase approaching it
      if (hoursBeforeNextEventHour === 1) return 'Lo-1';
      if (hoursBeforeNextEventHour === 2) return 'Lo-2';
      return 'Falling';
    }
  }
  
  if (!prevEvent || !nextEvent) {
    return '—';
  }
  
  const prevEventTime = new Date(prevEvent.time);
  const nextEventTime = new Date(nextEvent.time);
  
  // Get the hour that contains each event
  const prevEventHour = new Date(
    prevEventTime.getFullYear(),
    prevEventTime.getMonth(),
    prevEventTime.getDate(),
    prevEventTime.getHours()
  );
  
  const nextEventHour = new Date(
    nextEventTime.getFullYear(),
    nextEventTime.getMonth(),
    nextEventTime.getDate(),
    nextEventTime.getHours()
  );
  
  // Check if the current hour contains the next event
  if (currentHour.getTime() === nextEventHour.getTime()) {
    const timeStr = formatTimeForPhase(nextEventTime);
    return nextEvent.flag === 'high' ? `Hi (${timeStr})` : `Lo (${timeStr})`;
  }
  
  // Calculate hours from the hour containing each event
  const hoursAfterPrevEventHour = Math.round((currentHour.getTime() - prevEventHour.getTime()) / (1000 * 60 * 60));
  const hoursBeforeNextEventHour = Math.round((nextEventHour.getTime() - currentHour.getTime()) / (1000 * 60 * 60));
  
  // Determine the phase based on position between events
  if (prevEvent.flag === 'high' && nextEvent.flag === 'low') {
    // Falling tide: Hi -> Lo
    if (hoursAfterPrevEventHour === 1) return 'Hi+1';
    if (hoursAfterPrevEventHour === 2) return 'Hi+2';
    if (hoursBeforeNextEventHour === 2) return 'Lo-2';
    if (hoursBeforeNextEventHour === 1) return 'Lo-1';
    return 'Falling';
  } else if (prevEvent.flag === 'low' && nextEvent.flag === 'high') {
    // Rising tide: Lo -> Hi
    if (hoursAfterPrevEventHour === 1) return 'Lo+1';
    if (hoursAfterPrevEventHour === 2) return 'Lo+2';
    if (hoursBeforeNextEventHour === 2) return 'Hi-2';
    if (hoursBeforeNextEventHour === 1) return 'Hi-1';
    return 'Rising';
  }
  
  return '—';
}

/**
 * Format time for phase display (HH:MM)
 */
function formatTimeForPhase(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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

    // Check if tide data is available
    const tideDataSource = tideForecast && tideForecast.events.length > 0 ? 'real' : 'sample';
    const tideDataMessage = tideDataSource === 'sample' 
      ? 'Tide data unavailable for this location'
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
