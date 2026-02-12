export interface FishingSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  features?: string[];
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  visibility: number;
  conditions: string;
  timestamp: Date;
}

export interface TideData {
  time: Date;
  height: number;
  type: 'high' | 'low';
}

export interface TidePrediction {
  date: Date;
  tides: TideData[];
  sunrise?: Date;
  sunset?: Date;
}
