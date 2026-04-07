// Barentswatch Sea Current API types (BwRasterCurrentPoint schema)
// Endpoint: GET /v1/seacurrent/nearest/all?x={lon}&y={lat}
// Returns an array of forecast entries for each available time step.
export interface BarentswatchSeaCurrentEntry {
  current?: number | null; // m/s
  direction?: number | null; // Degrees (to-direction)
  forecastTime?: string | null; // ISO 8601
  longitude: number;
  latitude: number;
  source?: string | null;
}

/** The response from GET /v1/seacurrent/nearest/all is an array of BwRasterCurrentPoint */
export type BarentswatchSeaCurrentResponse = BarentswatchSeaCurrentEntry[];

/**
 * Type definitions for MET.no Locationforecast 2.0, Barentswatch Waveforecast,
 * and Kartverket Tide APIs
 */

// Locationforecast 2.0 types
export interface LocationForecastResponse {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
  properties: {
    meta: {
      updated_at: string;
      units: {
        air_pressure_at_sea_level?: string;
        air_temperature?: string;
        cloud_area_fraction?: string;
        precipitation_amount?: string;
        relative_humidity?: string;
        wind_from_direction?: string;
        wind_speed?: string;
      };
    };
    timeseries: LocationForecastTimeseries[];
  };
}

export interface LocationForecastTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        air_pressure_at_sea_level?: number;
        air_temperature?: number;
        air_temperature_percentile_10?: number;
        air_temperature_percentile_90?: number;
        cloud_area_fraction?: number;
        relative_humidity?: number;
        wind_from_direction?: number;
        wind_speed?: number;
        wind_speed_of_gust?: number;
        wind_speed_percentile_10?: number;
        wind_speed_percentile_90?: number;
      };
    };
    next_1_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
        precipitation_amount_min?: number;
        precipitation_amount_max?: number;
      };
    };
    next_6_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
        precipitation_amount_min?: number;
        precipitation_amount_max?: number;
      };
    };
  };
}

// Oceanforecast 2.0 types
export interface OceanForecastResponse {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number, number];
  };
  properties: {
    meta: {
      updated_at: string;
      units: {
        sea_surface_wave_height?: string;
        sea_surface_wave_from_direction?: string;
        sea_water_speed?: string;
        sea_water_temperature?: string;
        sea_water_to_direction?: string;
      };
    };
    timeseries: OceanForecastTimeseries[];
  };
}

export interface OceanForecastTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        sea_surface_wave_from_direction?: number;
        sea_surface_wave_height?: number;
        sea_water_speed?: number;
        sea_water_temperature?: number;
        sea_water_to_direction?: number;
      };
    };
  };
}

// Barentswatch Waveforecast API types (BwRasterWavePoint schema)
// Endpoint: GET /v1/waveforecastpoint/nearest/all?x={lon}&y={lat}
// Returns an array of forecast entries for each available time step.
export interface BarentswatchWaveEntry {
  totalSignificantWaveHeight?: number | null;  // Hs in metres
  expectedMaximumWaveHeight?: number | null;   // Hmax in metres
  totalMeanWaveDirection?: number | null;      // Degrees
  totalPeakPeriod?: number | null;             // Seconds
  forecastTime?: string | null;                // ISO 8601
  longitude: number;
  latitude: number;
  source?: string | null;
}

/** The response from GET /v1/waveforecastpoint/nearest/all is an array of BwRasterWavePoint */
export type BarentswatchWaveResponse = BarentswatchWaveEntry[];

/**
 * Combined hourly forecast representing merged weather and ocean data.
 * This interface combines data from both Locationforecast 2.0 (weather)
 * and Oceanforecast 2.0 (ocean conditions) for a single hour.
 * Used for display in the forecast table.
 */
export interface HourlyForecast {
  time: string;
  temperature?: number;
  windSpeed?: number;
  windDirection?: number;
  precipitation?: number;
  humidity?: number;
  cloudCover?: number;
  pressure?: number;
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
  seaTemperature?: number;
  currentSpeed?: number;
  currentDirection?: number;
  symbolCode?: string;
  tideHeight?: number;
  tidePhase?: string; // e.g., "Hi (13:18)", "Hi+1", "Falling", "Lo-2", etc.
  sunPhase?: string;  // e.g., "Daylight (06:23)", "Civil (17:45)", "Nautical (18:12)", "—"
  sunPhaseSegments?: { phase: 'day' | 'civil' | 'nautical' | 'night'; fraction: number }[];
  windGust?: number;
  moonPhase?: string; // e.g., "🌑 New Moon", "🌕 Full Moon"
}

// Kartverket Tide API XML types (high/low tide events)
export interface TideEvent {
  time: string; // ISO timestamp
  value: number; // Water level in cm
  flag: 'high' | 'low';
}

export interface TidePrediction {
  time: string; // ISO timestamp
  value: number; // Water level in cm
}

export interface TideXMLResponse {
  events: TideEvent[]; // High and low tide events
  stationName?: string;
  stationLat?: number;
  stationLng?: number;
  latitude: number;
  longitude: number;
}

/** Combined result from a single datatype=all Kartverket call for the tide page */
export interface TidePageData {
  events: TideEvent[];       // High/low peaks derived from the prediction block
  forecasts: TidePrediction[]; // 10-min forecast water levels (includes weather effects)
  currentLevel?: number;     // Latest observed water level (cm)
  currentLevelTime?: string; // Time of the latest observation
  stationName?: string;
  stationLat?: number;
  stationLng?: number;
}
