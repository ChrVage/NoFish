/**
 * MET.no Locationforecast API integration
 * Validates if weather data is available for a location
 */

export interface WeatherValidationResult {
  available: boolean;
  locationName?: string;
  error?: string;
}

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
          'User-Agent': 'NoFish/1.0 github.com/your-repo',
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
 * Fetch basic weather data for a location
 * Returns current conditions from the forecast
 */
export async function getWeatherForecast(lat: number, lng: number) {
  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?` +
        `lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`,
      {
        headers: {
          'User-Agent': 'NoFish/1.0 github.com/your-repo',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Weather fetch error:', error);
    throw error;
  }
}
