/**
 * Type definitions for MET.no Locationforecast 2.0 and Oceanforecast 2.0 APIs
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
        cloud_area_fraction?: number;
        relative_humidity?: number;
        wind_from_direction?: number;
        wind_speed?: number;
        wind_speed_of_gust?: number;
      };
    };
    next_1_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
      };
    };
    next_6_hours?: {
      summary: {
        symbol_code: string;
      };
      details: {
        precipitation_amount?: number;
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
  seaTemperature?: number;
  currentSpeed?: number;
  currentDirection?: number;
  symbolCode?: string;
  tideHeight?: number;
  tidePhase?: string; // e.g., "Hi (13:18)", "Hi+1", "Falling", "Lo-2", etc.
  sunPhase?: string;      // e.g., "Daylight (06:23)", "Civil (17:45)", "Nautical (18:12)", "—"
  sunElevation?: number;  // Sun altitude above/below horizon in degrees
  sunAzimuth?: number;    // Sun azimuth in degrees (0=N, 90=E, 180=S, 270=W)
}

// Kartverket Tide API types
export interface TideForecastResponse {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: {
    meta: {
      updated_at: string;
      station_name: string;
      station_code: string;
      units: {
        sea_surface_height_above_chart_datum: string;
      };
    };
    timeseries: TideForecastTimeseries[];
  };
}

export interface TideForecastTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        sea_surface_height_above_chart_datum: number;
      };
    };
  };
}

// Kartverket Tide API XML types (high/low tide events)
export interface TideEvent {
  time: string; // ISO timestamp
  value: number; // Water level in cm
  flag: 'high' | 'low';
}

export interface TideXMLResponse {
  events: TideEvent[]; // High and low tide events
  stationName?: string;
  latitude: number;
  longitude: number;
}
