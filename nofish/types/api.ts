import { WeatherData, TideData, TidePrediction } from './fishing';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface WeatherApiResponse extends ApiResponse<WeatherData> {}

export interface TideApiResponse extends ApiResponse<TidePrediction> {}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
