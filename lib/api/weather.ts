/**
 * MET.no Locationforecast API integration
 * Validates if weather data is available for a location
 */

import { XMLParser } from 'fast-xml-parser';
import type {
  LocationForecastResponse,
  OceanForecastResponse,
  HourlyForecast,
  TideEvent,
  TidePrediction,
  TidePageData,
  TideXMLResponse,
  BarentswatchWaveEntry,
  BarentswatchSeaCurrentEntry,
} from '@/types/weather';
import { getWaveForecast, getSeaCurrentForecast } from '@/lib/api/barentswatch';
import { getCached, setCached, withInflight } from '@/lib/db/cache';
import { getTimezone } from '@/lib/utils/timezone';
import { haversineDistance } from '@/lib/utils/distance';

/** Maximum distance (km) between the requested point and the ocean forecast grid point.
 *  Beyond this threshold the wave data is considered inaccurate and is suppressed. */
const MAX_OCEAN_FORECAST_DISTANCE_KM = 1;

const USER_AGENT = 'NoFish/1.0 github.com/ChrVage/NoFish';

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
 * Fetch Oceanforecast data from MET.no (kept for potential future use).
 * Currently unused — wave data now comes from Barentswatch.
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
      console.warn(`Oceanforecast API returned ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Oceanforecast fetch error:', error);
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
  // Cache key matches the API's own precision (integer lat/lon)
  const tideCacheKey = `tide:${lat.toFixed(0)}:${lng.toFixed(0)}`;
  const cachedTide = await getCached<TideXMLResponse>(tideCacheKey);
  if (cachedTide) return cachedTide;

  return withInflight<TideXMLResponse | null>(tideCacheKey, async () => {
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

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
        },
      });

      if (!response.ok) {
        console.warn(`Kartverket Tide API returned ${response.status}`);
        return null;
      }

      const text = await response.text();

      // Parse XML to extract high/low tide events
      const parsed = parseTideXML(text, lat, lng);
      // Cache for 6 hours — tide tables are predictable
      await setCached(tideCacheKey, parsed, 6);
      return parsed;
    } catch (error) {
      console.error('Tide API error:', error);
      return null;
    }
  });
}

/**
 * Fetch all tide data for the tide page from a single Kartverket API call (datatype=all).
 * Returns high/low events (from prediction peaks) and forecast water levels.
 * @param lat Latitude
 * @param lng Longitude
 * @returns Combined tide page data or null if unavailable
 */
export async function getTidePageData(
  lat: number,
  lng: number
): Promise<TidePageData | null> {
  const cacheKey = `tideall:${lat.toFixed(0)}:${lng.toFixed(0)}`;
  const cached = await getCached<TidePageData>(cacheKey);
  if (cached) return cached;

  return withInflight<TidePageData | null>(cacheKey, async () => {
    try {
      const fromTime = new Date();
      const toTime = new Date(fromTime.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead

      const fromTimeStr = fromTime.toISOString().replace(/\.\d{3}Z$/, '');
      const toTimeStr = toTime.toISOString().replace(/\.\d{3}Z$/, '');

      const baseParams =
          `lat=${lat.toFixed(0)}&lon=${lng.toFixed(0)}` +
          `&fromtime=${encodeURIComponent(fromTimeStr)}&totime=${encodeURIComponent(toTimeStr)}` +
          `&refcode=cd&lang=en&dst=0&tide_request=locationdata`;

      const allUrl = `https://vannstand.kartverket.no/tideapi.php?${baseParams}&datatype=all&interval=10`;
      const tabUrl = `https://vannstand.kartverket.no/tideapi.php?${baseParams}&datatype=tab`;

      const [allResponse, tabResponse] = await Promise.all([
        fetch(allUrl, { headers: { 'User-Agent': USER_AGENT } }),
        fetch(tabUrl, { headers: { 'User-Agent': USER_AGENT } }),
      ]);

      if (!allResponse.ok) {
        console.warn(`Kartverket Tide API (all) returned ${allResponse.status}`);
        return null;
      }

      const allText = await allResponse.text();
      const result = parseTideAllXML(allText);

      // Use exact high/low event times from the tab API when available
      if (tabResponse.ok) {
        const tabText = await tabResponse.text();
        const tabResult = parseTideXML(tabText, lat, lng);
        if (tabResult.events.length > 0) {
          result.events = tabResult.events;
        }
      }

      await setCached(cacheKey, result, 6);
      return result;
    } catch (error) {
      console.error('Tide API (all) error:', error);
      return null;
    }
  });
}

/**
 * Parse datatype=all XML from Kartverket.
 * Extracts high/low events from the prediction block (local maxima/minima)
 * and forecast water levels from the forecast block.
 */
function parseTideAllXML(xmlText: string): TidePageData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name) => name === 'data' || name === 'waterlevel',
  });

  type WaterLevelAttr = { value: string; time: string; flag?: string };
  type DataBlock = { type?: string; waterlevel?: WaterLevelAttr[] };
  type LocationAttr = { name?: string; lat?: string | number; lon?: string | number };
  type LocationData = { location?: LocationAttr; data?: DataBlock[] };
  type TideDoc = { tide?: { locationdata?: LocationData } };

  const doc = parser.parse(xmlText) as TideDoc;
  const locationdata = doc?.tide?.locationdata;

  let stationName: string | undefined;
  let stationLat: number | undefined;
  let stationLng: number | undefined;

  const location = locationdata?.location;
  if (location) {
    stationName = location.name;
    if (location.lat != null) stationLat = parseFloat(String(location.lat));
    if (location.lon != null) stationLng = parseFloat(String(location.lon));
  }

  // Extract prediction data, forecast data, and observation data
  const predictions: { time: string; value: number }[] = [];
  const forecasts: TidePrediction[] = [];
  let currentLevel: number | undefined;
  let currentLevelTime: string | undefined;

  for (const block of locationdata?.data ?? []) {
    if (block.type === 'prediction') {
      for (const wl of block.waterlevel ?? []) {
        predictions.push({ time: wl.time, value: parseFloat(wl.value) });
      }
    } else if (block.type === 'forecast') {
      for (const wl of block.waterlevel ?? []) {
        forecasts.push({ time: wl.time, value: parseFloat(wl.value) });
      }
    } else if (block.type === 'observation') {
      // Take the last (most recent) observation
      const levels = block.waterlevel ?? [];
      if (levels.length > 0) {
        const last = levels[levels.length - 1];
        currentLevel = parseFloat(last.value);
        currentLevelTime = last.time;
      }
    }
  }

  // Fallback: if no observation, use the closest forecast value to now
  if (currentLevel == null && forecasts.length > 0) {
    const nowMs = Date.now();
    let bestIdx = 0;
    let bestDiff = Math.abs(new Date(forecasts[0].time).getTime() - nowMs);
    for (let i = 1; i < forecasts.length; i++) {
      const diff = Math.abs(new Date(forecasts[i].time).getTime() - nowMs);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    if (bestDiff < 15 * 60 * 1000) {
      currentLevel = forecasts[bestIdx].value;
      currentLevelTime = forecasts[bestIdx].time;
    }
  }

  // Derive high/low events from local maxima/minima in prediction data
  const events: TideEvent[] = [];
  for (let i = 1; i < predictions.length - 1; i++) {
    const prev = predictions[i - 1].value;
    const curr = predictions[i].value;
    const next = predictions[i + 1].value;
    if (curr > prev && curr >= next) {
      events.push({ time: predictions[i].time, value: curr, flag: 'high' });
    } else if (curr < prev && curr <= next) {
      events.push({ time: predictions[i].time, value: curr, flag: 'low' });
    }
  }

  return { events, forecasts, currentLevel, currentLevelTime, stationName, stationLat, stationLng };
}

/** Find the closest entry (by forecastTime) within a tolerance window. */
function findClosestEntry<T extends { forecastTime?: string | null }>(
  entries: T[],
  targetMs: number,
  toleranceMs: number = 30 * 60_000,
): T | undefined {
  let best: T | undefined;
  let bestDiff = toleranceMs;
  for (const e of entries) {
    if (!e?.forecastTime) continue;
    const diff = Math.abs(new Date(e.forecastTime).getTime() - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = e;
    }
  }
  return best;
}

/**
 * Combine location, wave (Barentswatch), and tide forecast data into hourly forecast
 * @param locationForecast Location forecast data (MET Norway)
 * @param waveEntries Barentswatch wave forecast entries (optional)
 * @param tideForecast Tide forecast data with high/low events (optional)
 * @param lat Latitude for sun calculations
 * @param lng Longitude for sun calculations
 * @returns Array of hourly forecasts
 */
export function combineForecasts(
  locationForecast: LocationForecastResponse,
  waveEntries: BarentswatchWaveEntry[] | null,
  tideForecast: TideXMLResponse | null,
  lat: number,
  lng: number,
  seaCurrentEntries?: BarentswatchSeaCurrentEntry[] | null,
  oceanForecast?: OceanForecastResponse | null
): HourlyForecast[] {
  const timezone = getTimezone(lat, lng);
  const hourlyForecasts: HourlyForecast[] = [];

  // Create a map of wave data by time for quick lookup
  const waveDataMap = new Map<string, BarentswatchWaveEntry>();
  if (waveEntries) {
    for (const entry of waveEntries) {
      if (entry?.forecastTime) {
        waveDataMap.set(entry.forecastTime, entry);
      }
    }
  }

  // Create a map of sea current data by time for quick lookup
  const currentDataMap = new Map<string, BarentswatchSeaCurrentEntry>();
  // Check whether the dataset contains ANY real current values (speed or direction)
  let hasAnyCurrent = false;
  if (seaCurrentEntries) {
    for (const entry of seaCurrentEntries) {
      if (entry?.forecastTime) {
        currentDataMap.set(entry.forecastTime, entry);
      }
      if (entry?.current != null || entry?.direction != null) {
        hasAnyCurrent = true;
      }
    }
  }

  // Create a map of sea temperature by time if oceanForecast is provided
  let seaTempMap: Map<string, number> | undefined;
  if (oceanForecast) {
    seaTempMap = new Map();
    for (const ts of oceanForecast.properties.timeseries) {
      const temp = ts.data.instant.details.sea_water_temperature;
      if (temp !== undefined) {
        seaTempMap.set(ts.time, temp);
      }
    }
  }

  // Process location forecast timeseries
  locationForecast.properties.timeseries.forEach((entry, index) => {
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
      humidity: entry.data.instant.details.relative_humidity,
      cloudCover: entry.data.instant.details.cloud_area_fraction,
      pressure: entry.data.instant.details.air_pressure_at_sea_level,
      precipitation: entry.data.next_1_hours?.details.precipitation_amount,
      symbolCode: entry.data.next_1_hours?.summary.symbol_code ||
                  entry.data.next_6_hours?.summary.symbol_code,
    };

    // Add Barentswatch wave data if available
    // Try exact time match first, then find the closest entry within 30 min
    const waveData = waveDataMap.get(entry.time)
      ?? (waveEntries?.length ? findClosestEntry(waveEntries, entryDate.getTime()) : undefined);

    if (waveData) {
      hourlyForecast.waveHeight = waveData.totalSignificantWaveHeight ?? undefined;
      hourlyForecast.waveDirection = waveData.totalMeanWaveDirection ?? undefined;
    }

    // Add tide phase if tide data is available
    if (tideForecast && tideForecast.events.length > 0) {
      hourlyForecast.tidePhase = calculateTidePhase(entryDate, windowEnd, tideForecast.events, timezone);
    }

    // Add sun data
    const sunResult = calculateSunPhase(entryDate, windowEnd, lat, lng, timezone);
    hourlyForecast.sunPhase = sunResult.label;
    hourlyForecast.sunPhaseSegments = sunResult.segments;

    // Add moon phase
    hourlyForecast.moonPhase = calculateMoonPhase(entryDate);

    // Add Barentswatch sea current data if available
    const currentData = currentDataMap.get(entry.time)
      ?? (seaCurrentEntries?.length ? findClosestEntry(seaCurrentEntries, entryDate.getTime()) : undefined);
    if (currentData) {
      // If a current record exists for this hour, treat null as 0 (dead water)
      hourlyForecast.currentSpeed = currentData.current ?? 0;
      hourlyForecast.currentDirection = currentData.direction ?? undefined;
    } else if (hasAnyCurrent) {
      // Dataset has current data but this hour is missing — treat as 0 (dead water)
      hourlyForecast.currentSpeed = 0;
    }

    // Add sea temperature from MET.no Oceanforecast if available
    if (seaTempMap) {
      const temp = seaTempMap.get(entry.time);
      if (temp !== undefined) {
        hourlyForecast.seaTemperature = temp;
      }
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
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    // Ensure these are always arrays even when only one element is present
    isArray: (name) => name === 'data' || name === 'waterlevel',
  });

  type WaterLevelAttr = { value: string; time: string; flag: string };
  type DataBlock = { waterlevel?: WaterLevelAttr[] };
  type LocationAttr = { name?: string; lat?: string | number; lon?: string | number };
  type LocationData = { location?: LocationAttr; data?: DataBlock[] };
  type TideDoc = { tide?: { locationdata?: LocationData } };

  const doc = parser.parse(xmlText) as TideDoc;
  const locationdata = doc?.tide?.locationdata;

  let stationName: string | undefined;
  let stationLat: number | undefined;
  let stationLng: number | undefined;

  const location = locationdata?.location;
  if (location) {
    stationName = location.name;
    if (location.lat != null) stationLat = parseFloat(String(location.lat));
    if (location.lon != null) stationLng = parseFloat(String(location.lon));
  }

  const events: TideEvent[] = [];
  for (const block of locationdata?.data ?? []) {
    for (const wl of block.waterlevel ?? []) {
      if (wl.flag !== 'high' && wl.flag !== 'low') continue;
      events.push({
        time: wl.time,
        value: parseFloat(wl.value),
        flag: wl.flag,
      });
    }
  }

  return { events, stationName, stationLat, stationLng, latitude: lat, longitude: lng };
}

/**
 * Calculate tide phase for a time window.
 *
 * If any high/low tide event falls within [windowStart, windowEnd) those events
 * are listed explicitly, e.g. "Hi (13:18)", "Lo (19:30)", or
 * "Hi (13:18) · Lo (19:30)" when multiple events occur in the window.
 *
 * For 1-hour windows only: hours adjacent to a tide event are labelled
 * Hi-2, Hi-1, Hi+1, Hi+2 (or Lo±) when the event time rounds to exactly
 * 1 or 2 hours from the window start.
 *
 * Only when none of the above applies is "Rising" or "Falling" returned.
 */
function calculateTidePhase(
  windowStart: Date,
  windowEnd: Date,
  tideEvents: TideEvent[],
  timezone: string
): string {
  if (!tideEvents || tideEvents.length === 0) {
    return '—';
  }

  // Determine window duration before any branching
  const windowDurationMs = windowEnd.getTime() - windowStart.getTime();
  const isHourlyWindow = Math.abs(windowDurationMs - 60 * 60 * 1000) < 60 * 1000;

  // 1. Collect all events that fall inside [windowStart, windowEnd)
  const eventsInWindow = tideEvents.filter((e) => {
    const t = new Date(e.time);
    return t >= windowStart && t < windowEnd;
  });

  if (eventsInWindow.length > 0) {
    // Always show exact time for Hi/Lo events
    return eventsInWindow
      .map((e) => {
        const timeStr = formatTimeForPhase(new Date(e.time), timezone);
        return e.flag === 'high' ? `Hi (${timeStr})` : `Lo (${timeStr})`;
      })
      .join(' · ');
  }

  // 2. No event in window — find the closest bracketing events
  let prevEvent: TideEvent | null = null;
  let nextEvent: TideEvent | null = null;

  for (const e of tideEvents) {
    const t = new Date(e.time);
    if (t < windowStart) {
      prevEvent = e;
    } else if (t >= windowEnd && !nextEvent) {
      nextEvent = e;
      break;
    }
  }

  // 3. For 1-hour windows only, try Hi/Lo ±1/±2 labels.
  //    Slot distance is counted using the event's floored hour bucket so that
  //    the position of the event within its hour does not affect adjacent labels.
  //    e.g. Hi at 13:45 → bucket = 13:00
  //         window 12:00-13:00 → 1 slot before bucket → Hi-1
  //         window 11:00-12:00 → 2 slots before bucket → Hi-2

  if (isHourlyWindow) {
    const HOUR_MS = 3600 * 1000;

    let nextLabel: string | null = null;
    let nextSlots = Infinity;
    let prevLabel: string | null = null;
    let prevSlots = Infinity;

    if (nextEvent) {
      // Floor the event time to its hour bucket
      const bucketMs = Math.floor(new Date(nextEvent.time).getTime() / HOUR_MS) * HOUR_MS;
      const slots = (bucketMs - windowStart.getTime()) / HOUR_MS;
      if (slots === 1 || slots === 2) {
        const label = nextEvent.flag === 'high' ? 'Hi' : 'Lo';
        nextLabel = `${label}-${slots}h`;
        nextSlots = slots;
      }
    }

    if (prevEvent) {
      const bucketMs = Math.floor(new Date(prevEvent.time).getTime() / HOUR_MS) * HOUR_MS;
      const slots = (windowStart.getTime() - bucketMs) / HOUR_MS;
      if (slots === 1 || slots === 2) {
        const label = prevEvent.flag === 'high' ? 'Hi' : 'Lo';
        prevLabel = `${label}+${slots}h`;
        prevSlots = slots;
      }
    }

    // Nearest event wins; if equally near, prefer the upcoming one (negative side)
    if (nextLabel && prevLabel) {
      return nextSlots <= prevSlots ? nextLabel : prevLabel;
    }
    if (nextLabel) return nextLabel;
    if (prevLabel) return prevLabel;
  }

  // 4. Fall back to Rising / Falling
  if (!prevEvent && nextEvent) {
    return nextEvent.flag === 'high' ? 'Rising' : 'Falling';
  }
  if (prevEvent && !nextEvent) {
    return prevEvent.flag === 'high' ? 'Falling' : 'Rising';
  }
  if (prevEvent && nextEvent) {
    if (prevEvent.flag === 'low' && nextEvent.flag === 'high') return 'Rising';
    if (prevEvent.flag === 'high' && nextEvent.flag === 'low') return 'Falling';
  }

  return '—';
}

/**
 * Format time for phase display (HH:MM) in the location's local timezone.
 */
function formatTimeForPhase(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
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
 *
 * Also returns phase segments with fractional durations for background colouring.
 */
function calculateSunPhase(
  windowStart: Date,
  windowEnd: Date,
  lat: number,
  lng: number,
  timezone: string
): { label: string; segments: { phase: SunPhaseName; fraction: number }[] } {
  const startPhase = getSunPhaseName(solarPosition(windowStart, lat, lng).elevation);
  const windowMs = windowEnd.getTime() - windowStart.getTime();
  const windowMinutes = Math.ceil(windowMs / 60_000);

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

  // Build segments with fractional durations
  const segments: { phase: SunPhaseName; fraction: number }[] = [];
  if (transitions.length === 0) {
    segments.push({ phase: startPhase, fraction: 1 });
  } else {
    let segStart = windowStart.getTime();
    let currentPhase = startPhase;
    for (const tr of transitions) {
      const segEnd = tr.time.getTime();
      segments.push({ phase: currentPhase, fraction: (segEnd - segStart) / windowMs });
      segStart = segEnd;
      currentPhase = tr.to;
    }
    segments.push({ phase: currentPhase, fraction: (windowEnd.getTime() - segStart) / windowMs });
  }

  if (transitions.length === 0) {
    let label = sunPhaseLabels[startPhase];
    if (startPhase === 'day') {
      const noon = findSolarNoon(windowStart, windowEnd, lat, lng);
      if (noon) {
        const noonElevation = solarPosition(noon, lat, lng).elevation;
        label = `Daylight (${formatTimeHHMM(noon, timezone)}, ${noonElevation.toFixed(1)}°)`;
      }
    }
    return { label, segments };
  }

  // Build compound label: "Phase1 (T1) → Phase2 (T2) → Phase3 ..."
  let label = sunPhaseLabels[startPhase];
  for (const tr of transitions) {
    label += ` (${formatTimeHHMM(tr.time, timezone)}) → ${sunPhaseLabels[tr.to]}`;
  }
  return { label, segments };
}

/**
 * Format a UTC Date as HH:MM in the location's IANA timezone.
 */
function formatTimeHHMM(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(utcDate);
}

// ---------------------------------------------------------------------------
// Moon phase calculation (synodic month / known new-moon epoch)
// ---------------------------------------------------------------------------

/** Reference new moon: 6 January 2000 18:14 UTC */
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
/** Average synodic month in milliseconds */
const SYNODIC_MONTH_MS = 29.53058770576 * 86_400_000;

/**
 * Calculate moon phase label for a given UTC date.
 * Returns an emoji + name string, e.g. "🌕 Full Moon".
 */
function calculateMoonPhase(date: Date): string {
  const daysSinceEpoch = (date.getTime() - NEW_MOON_EPOCH_MS) / 86_400_000;
  const age = ((daysSinceEpoch % 29.53058770576) + 29.53058770576) % 29.53058770576;

  if (age < 1.85)  return '🌑 New Moon';
  if (age < 7.38)  return '🌒 Waxing Crescent';
  if (age < 9.23)  return '🌓 First Quarter';
  if (age < 14.77) return '🌔 Waxing Gibbous';
  if (age < 16.61) return '🌕 Full Moon';
  if (age < 22.15) return '🌖 Waning Gibbous';
  if (age < 23.99) return '🌗 Last Quarter';
  if (age < 27.68) return '🌘 Waning Crescent';
  return '🌑 New Moon';
}

/**
 * Fetch combined weather, ocean, and tide forecast for a location
 * @param lat Latitude
 * @param lng Longitude
 * @returns Array of hourly forecasts with metadata
 */
export interface CombinedForecastResult {
  forecasts: HourlyForecast[];
  // MET Norway Locationforecast grid point
  forecastLat: number;
  forecastLng: number;
  // Barentswatch Waveforecast grid point (undefined if wave data unavailable)
  oceanForecastLat?: number;
  oceanForecastLng?: number;
  waveForecastSource?: 'barentswatch';
  // Kartverket tide station (undefined if tide data unavailable)
  tideStationName?: string;
  tideStationLat?: number;
  tideStationLng?: number;
  metadata: Record<string, never>;
}

export async function getCombinedForecast(
  lat: number,
  lng: number,
  options?: { isSea?: boolean },
): Promise<CombinedForecastResult> {
  // Cache key uses 2 dp (≈1 km) — forecast resolution doesn't need more
  const weatherCacheKey = `weather:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cachedWeather = await getCached<CombinedForecastResult>(weatherCacheKey);
  if (cachedWeather) return cachedWeather;

  return withInflight(weatherCacheKey, async () => {
    // Skip ocean-related API calls for inland points (saves 4 upstream requests)
    const skipOcean = options?.isSea === false;

    // Fetch all forecasts in parallel
    const [locationForecast, waveForecast, seaCurrentForecast, tideForecast, oceanForecast] = await Promise.all([
      getLocationForecast(lat, lng),
      skipOcean ? Promise.resolve(null) : getWaveForecast(lat, lng),
      skipOcean ? Promise.resolve(null) : getSeaCurrentForecast(lat, lng),
      skipOcean ? Promise.resolve(null) : getTideForecast(lat, lng),
      skipOcean ? Promise.resolve(null) : getOceanForecast(lat, lng),
    ]);

    // Only pass tide data if real events were returned
    const realTideForecast = tideForecast && tideForecast.events.length > 0 ? tideForecast : null;

    // GeoJSON coordinates are [longitude, latitude, altitude]
    const forecastLng = locationForecast.geometry.coordinates[0];
    const forecastLat = locationForecast.geometry.coordinates[1];

    // Barentswatch wave forecast grid point (from the first entry with coordinates)
    let waveForecastLat: number | undefined;
    let waveForecastLng: number | undefined;
    let usableWaveEntries: BarentswatchWaveEntry[] | null = null;

    if (waveForecast && waveForecast.length > 0) {
      const firstEntry = waveForecast[0];
      waveForecastLat = firstEntry.latitude;
      waveForecastLng = firstEntry.longitude;

      // Suppress wave data when the grid point is too far from the requested location
      const waveDistance = waveForecastLat !== undefined && waveForecastLng !== undefined
        ? haversineDistance(lat, lng, waveForecastLat, waveForecastLng)
        : null;

      if (waveDistance === null || waveDistance <= MAX_OCEAN_FORECAST_DISTANCE_KM) {
        usableWaveEntries = waveForecast;
      } else {
        waveForecastLat = undefined;
        waveForecastLng = undefined;
      }
    }

    // Suppress tide data when wave data is unavailable — without wave context
    // the tide and score pages aren't meaningful for this location.
    const usableTideForecast = usableWaveEntries ? realTideForecast : null;

    const result: CombinedForecastResult = {
      forecasts: combineForecasts(locationForecast, usableWaveEntries, usableTideForecast, lat, lng, seaCurrentForecast, oceanForecast),
      forecastLat,
      forecastLng,
      oceanForecastLat: waveForecastLat,
      oceanForecastLng: waveForecastLng,
      waveForecastSource: usableWaveEntries ? 'barentswatch' : undefined,
      tideStationName: usableTideForecast?.stationName,
      tideStationLat: usableTideForecast?.stationLat,
      tideStationLng: usableTideForecast?.stationLng,
      metadata: {} as Record<string, never>,
    };

    // Cache for 1 hour — weather changes, but not every minute
    await setCached(weatherCacheKey, result, 1);

    return result;
  });
}
