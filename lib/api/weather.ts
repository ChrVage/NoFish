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
      `https://api.met.no/weatherapi/locationforecast/2.0/complete?` +
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
 * @param lat Latitude for sun calculations
 * @param lng Longitude for sun calculations
 * @returns Array of hourly forecasts
 */
export function combineForecasts(
  locationForecast: LocationForecastResponse,
  oceanForecast: OceanForecastResponse | null,
  tideForecast: TideXMLResponse | null,
  lat: number,
  lng: number
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
  locationForecast.properties.timeseries.forEach((entry, index) => {
    const oceanData = oceanDataMap.get(entry.time);
    
    const entryDate = new Date(entry.time);
    // Window runs from this entry to the next (1 h or 6 h); fall back to +1 h for the last entry
    const nextEntry = locationForecast.properties.timeseries[index + 1];
    const windowEnd = nextEntry
      ? new Date(nextEntry.time)
      : new Date(entryDate.getTime() + 60 * 60_000);

    const hourlyForecast: HourlyForecast = {
      time: entry.time,
      temperature: entry.data.instant.details.air_temperature,
      windSpeed: entry.data.instant.details.wind_speed,
      windDirection: entry.data.instant.details.wind_from_direction,
      windGust: entry.data.instant.details.wind_speed_of_gust,
      windSpeedP10: entry.data.instant.details.wind_speed_percentile_10,
      windSpeedP90: entry.data.instant.details.wind_speed_percentile_90,
      humidity: entry.data.instant.details.relative_humidity,
      cloudCover: entry.data.instant.details.cloud_area_fraction,
      pressure: entry.data.instant.details.air_pressure_at_sea_level,
      precipitation: entry.data.next_1_hours?.details.precipitation_amount,
      precipitationMin: entry.data.next_1_hours?.details.precipitation_amount_min,
      precipitationMax: entry.data.next_1_hours?.details.precipitation_amount_max,
      temperatureP10: entry.data.instant.details.air_temperature_percentile_10,
      temperatureP90: entry.data.instant.details.air_temperature_percentile_90,
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

    // Add sun data
    const sun = calculateSunPhase(entryDate, windowEnd, lat, lng);
    hourlyForecast.sunPhase = sun.phase;
    hourlyForecast.sunElevation = Math.round(sun.elevation * 10) / 10;
    hourlyForecast.sunAzimuth = Math.round(sun.azimuth * 10) / 10;

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
 * Format time for phase display (HH:MM) - local time of the Date object
 */
function formatTimeForPhase(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// Solar position calculation (NOAA/Meeus algorithm, accurate to ~0.5°)
// ---------------------------------------------------------------------------

const _rad = Math.PI / 180;
const _deg = 180 / Math.PI;

/**
 * Calculate the sun's elevation and azimuth for a given moment and location.
 * @param date  UTC date/time
 * @param lat   Latitude in degrees
 * @param lng   Longitude in degrees
 * @returns elevation (–90…90°, positive = above horizon), azimuth (0=N, 90=E, 180=S, 270=W)
 */
function solarPosition(
  date: Date,
  lat: number,
  lng: number
): { elevation: number; azimuth: number } {
  // Days since J2000.0
  const d = date.getTime() / 86400000 - 10957.5;

  // Mean longitude and mean anomaly (degrees)
  const L = ((280.460 + 0.9856474 * d) % 360 + 360) % 360;
  const g = ((357.528 + 0.9856003 * d) % 360 + 360) % 360;

  // Ecliptic longitude
  const lambda =
    L + 1.915 * Math.sin(g * _rad) + 0.020 * Math.sin(2 * g * _rad);

  // Obliquity of ecliptic
  const epsilon = 23.439 - 0.0000004 * d;

  // Right ascension and declination
  const sinLambda = Math.sin(lambda * _rad);
  const RA =
    Math.atan2(
      Math.cos(epsilon * _rad) * sinLambda,
      Math.cos(lambda * _rad)
    ) * _deg;
  const decl = Math.asin(Math.sin(epsilon * _rad) * sinLambda) * _deg;

  // Greenwich Mean Sidereal Time (degrees)
  const GMST = ((18.697374558 + 24.06570982441908 * d) % 24) * 15;

  // Local Hour Angle
  const LHA = ((GMST + lng - RA) % 360 + 360) % 360;

  // Elevation
  const sinAlt =
    Math.sin(decl * _rad) * Math.sin(lat * _rad) +
    Math.cos(decl * _rad) * Math.cos(lat * _rad) * Math.cos(LHA * _rad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * _deg;

  // Azimuth (N=0, clockwise)
  const cosAz =
    (Math.sin(decl * _rad) - Math.sin(elevation * _rad) * Math.sin(lat * _rad)) /
    (Math.cos(elevation * _rad) * Math.cos(lat * _rad));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * _deg;
  if (Math.sin(LHA * _rad) > 0) azimuth = 360 - azimuth;

  return { elevation, azimuth };
}

type SunPhaseName = 'day' | 'civil' | 'nautical' | 'night';

function getSunPhaseName(elevation: number): SunPhaseName {
  if (elevation >= 0) return 'day';
  if (elevation >= -6) return 'civil';
  if (elevation >= -12) return 'nautical';
  return 'night'; // astronomical twilight and full night
}

const sunPhaseLabels: Record<SunPhaseName, string> = {
  day: 'Daylight',
  civil: 'Civil',
  nautical: 'Nautical',
  night: 'Night',
};

/**
 * Find solar noon within [windowStart, windowEnd).
 * Returns the time if it occurs within the window, otherwise null.
 */
function findSolarNoon(
  windowStart: Date,
  windowEnd: Date,
  lat: number,
  lng: number
): Date | null {
  const windowMinutes = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 60_000);
  let prevAz = solarPosition(windowStart, lat, lng).azimuth;
  for (let m = 1; m <= windowMinutes; m++) {
    const t = new Date(windowStart.getTime() + m * 60_000);
    if (t >= windowEnd) break;
    const az = solarPosition(t, lat, lng).azimuth;
    if ((prevAz < 180 && az >= 180) || (prevAz <= 180 && az > 180)) {
      let lo = new Date(t.getTime() - 60_000);
      let hi = t;
      for (let i = 0; i < 10; i++) {
        const mid = new Date((lo.getTime() + hi.getTime()) / 2);
        if (solarPosition(mid, lat, lng).azimuth < 180) lo = mid;
        else hi = mid;
      }
      return new Date((lo.getTime() + hi.getTime()) / 2);
    }
    prevAz = az;
  }
  return null;
}

/**
 * Calculate the sun phase label for the window [windowStart, windowEnd).
 * Finds every day→civil→nautical→night transition that occurs in the window
 * and emits a label like:
 *   "Daylight (17:45) → Civil (18:12) → Nautical"
 * For a pure daylight window the solar-noon time is shown:
 *   "Daylight (12:34)"
 */
function calculateSunPhase(
  windowStart: Date,
  windowEnd: Date,
  lat: number,
  lng: number
): { phase: string; elevation: number; azimuth: number } {
  // Midpoint position for elevation / azimuth display
  const mid = new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
  const midPos = solarPosition(mid, lat, lng);

  const startPhase = getSunPhaseName(solarPosition(windowStart, lat, lng).elevation);
  const windowMinutes = Math.ceil((windowEnd.getTime() - windowStart.getTime()) / 60_000);

  // Collect every phase transition within the window
  const transitions: { time: Date; to: SunPhaseName }[] = [];
  let prevPhase = startPhase;

  for (let m = 1; m <= windowMinutes; m++) {
    const t = new Date(windowStart.getTime() + m * 60_000);
    if (t >= windowEnd) break;
    const p = getSunPhaseName(solarPosition(t, lat, lng).elevation);
    if (p !== prevPhase) {
      let lo = new Date(t.getTime() - 60_000);
      let hi = t;
      for (let i = 0; i < 10; i++) {
        const bMid = new Date((lo.getTime() + hi.getTime()) / 2);
        if (getSunPhaseName(solarPosition(bMid, lat, lng).elevation) === prevPhase) lo = bMid;
        else hi = bMid;
      }
      transitions.push({ time: new Date((lo.getTime() + hi.getTime()) / 2), to: p });
      prevPhase = p;
    }
  }

  if (transitions.length === 0) {
    let label = sunPhaseLabels[startPhase];
    if (startPhase === 'day') {
      const noon = findSolarNoon(windowStart, windowEnd, lat, lng);
      if (noon) label = `Daylight (${formatTimeHHMM(noon, lng)})`;
    }
    return { phase: label, elevation: midPos.elevation, azimuth: midPos.azimuth };
  }

  // Build compound label: "Phase1 (T1) → Phase2 (T2) → Phase3 ..."
  let label = sunPhaseLabels[startPhase];
  for (const tr of transitions) {
    label += ` (${formatTimeHHMM(tr.time, lng)}) → ${sunPhaseLabels[tr.to]}`;
  }
  return { phase: label, elevation: midPos.elevation, azimuth: midPos.azimuth };
}

/**
 * Format a UTC Date as HH:MM in the local solar time offset by longitude
 * (approximation: UTC + lng/15 hours). For Norway (lon ~5-30°) this is close
 * enough to CET/CEST for labelling purposes.
 * For exact wall-clock time we'd need a tz library; instead we just use
 * the Date's local time which on the server is UTC, so we add the offset.
 */
function formatTimeHHMM(utcDate: Date, lng: number): string {
  // Offset in ms: Norway is UTC+1 (winter) or UTC+2 (summer)
  // Since the forecasts come tagged with +01:00 or +02:00 we derive the
  // offset from the longitude: approx UTC+1 for most of Norway.
  // Simple approach: display Norway local time = UTC+1 (standard).
  const localMs = utcDate.getTime() + 60 * 60000; // UTC+1 fixed offset
  const d = new Date(localMs);
  const hh = d.getUTCHours().toString().padStart(2, '0');
  const mm = d.getUTCMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
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
      forecasts: combineForecasts(locationForecast, oceanForecast, tideForecast, lat, lng),
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
