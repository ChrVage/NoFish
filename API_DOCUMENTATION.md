# NoFish Public API v1 Documentation

## Overview

The NoFish Public API provides access to fishing conditions data combining weather forecasts, wave data, sea currents, and tide information for Norwegian coastal waters.

**API Base URL**: `https://nofish.app/api/v1`

## Authentication

### Registration

Before making API requests, you must register a contact email to obtain an API key.

**Endpoint**: `POST /api/v1/register`

**Request**:
```json
{
  "email": "your.email@example.com"
}
```

**Response** (Success - 201):
```json
{
  "success": true,
  "key": "your-64-character-hexadecimal-api-key",
  "email": "your.email@example.com",
  "generated_at": "2026-05-09T12:34:56.789Z",
  "source_credit": "API powered by MET Norway, Barentswatch, Kartverket"
}
```

**Response** (Error - 409 if email already registered):
```json
{
  "success": false,
  "error": "Email already registered. Contact support for a new key.",
  "generated_at": "2026-05-09T12:34:56.789Z"
}
```

**cURL Example**:
```bash
curl -X POST https://nofish.app/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

### Using Your API Key

Include your API key in the `X-Api-Key` header on all subsequent requests:

```
X-Api-Key: your-64-character-hexadecimal-api-key
```

## Rate Limiting

All API keys have the following rate limits:

- **Per-minute**: 10 requests per minute
- **Per-day**: 100 requests per day

Rate limit responses return a `429 Too Many Requests` status with headers:
- `Retry-After`: Seconds until the next request is allowed
- `X-RateLimit-Limit-Minute`: Minute limit
- `X-RateLimit-Used-Minute`: Minute usage
- `X-RateLimit-Reset-Minute`: ISO timestamp when the minute window resets

## Endpoints

### 1. GET /api/v1/score

Returns fishing score data including best fishing windows and hourly scores.

**Required Query Parameters**:
- `lat`: Latitude (decimal degrees, e.g., 59.91)
- `lon`: Longitude (decimal degrees, e.g., 10.75)

**Optional Query Parameters**:
- `boat`: Boat size preset (`15-19`, `20-24`, `25-30`, `31-40`; defaults to `20-24`)
- `fish`: Fish target species (`cod`, `saithe`, `haddock`, `ling`, `tusk`, etc.; defaults to `cod`)
- `method`: Fishing method (`rod`, `net`, `jig`, etc.; defaults to `rod`)
- `depth`: Water depth in meters (0-1000; defaults to deep-water profile)

**Response** (Success - 200):
```json
{
  "success": true,
  "best_windows": [
    {
      "start_hour": 2,
      "duration_hours": 3,
      "average_score": 78
    },
    {
      "start_hour": 14,
      "duration_hours": 2,
      "average_score": 65
    }
  ],
  "hourly_scores": [
    {
      "time": "2026-05-09T12:00:00Z",
      "score": 45,
      "safety_score": 60,
      "fishing_score": 40
    },
    {
      "time": "2026-05-09T13:00:00Z",
      "score": 62,
      "safety_score": 75,
      "fishing_score": 58
    }
  ],
  "generated_at": "2026-05-09T12:34:56.789Z",
  "source_credit": "Data from MET Norway (weather), Barentswatch (waves, currents), Kartverket (tide)"
}
```

**Response** (Error - 404 if no data available):
```json
{
  "success": false,
  "error": "No forecast data available for this location",
  "generated_at": "2026-05-09T12:34:56.789Z"
}
```

**cURL Examples**:

Basic request with just coordinates:
```bash
curl "https://nofish.app/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: your-api-key"
```

Request with optional parameters:
```bash
curl "https://nofish.app/api/v1/score?lat=59.91&lon=10.75&boat=25-30&fish=cod&method=rod&depth=80" \
  -H "X-Api-Key: your-api-key"
```

### 2. GET /api/v1/tide

Returns high and low tide events for the specified location.

**Required Query Parameters**:
- `lat`: Latitude (decimal degrees, e.g., 59.91)
- `lon`: Longitude (decimal degrees, e.g., 10.75)

**Optional Query Parameters** (accepted for consistency with /score but not used):
- `boat`: Boat size preset
- `fish`: Fish target species
- `method`: Fishing method

**Response** (Success - 200):
```json
{
  "success": true,
  "events": [
    {
      "time": "2026-05-09T08:32:00Z",
      "value_cm": 145,
      "type": "high"
    },
    {
      "time": "2026-05-09T14:18:00Z",
      "value_cm": -85,
      "type": "low"
    },
    {
      "time": "2026-05-09T21:05:00Z",
      "value_cm": 152,
      "type": "high"
    }
  ],
  "station_name": "Filtvet",
  "station_lat": 59.91,
  "station_lng": 10.75,
  "generated_at": "2026-05-09T12:34:56.789Z",
  "source_credit": "Tide data from Kartverket, weather context from MET Norway & Barentswatch"
}
```

**Response** (Error - 404 if no data available):
```json
{
  "success": false,
  "error": "No tide data available for this location",
  "generated_at": "2026-05-09T12:34:56.789Z"
}
```

**cURL Example**:
```bash
curl "https://nofish.app/api/v1/tide?lat=59.91&lon=10.75" \
  -H "X-Api-Key: your-api-key"
```

## Response Format

All API responses are JSON with the following guarantees:

- **Success responses** (2xx): Include `success: true` and `generated_at` ISO timestamp
- **Error responses** (4xx, 5xx): Include `success: false`, `error` message, and `generated_at` ISO timestamp
- **Source credit**: Both endpoints include a `source_credit` field acknowledging data sources:
  - MET Norway Locationforecast 2.0 (weather)
  - Barentswatch Waveforecast (wave height, period, direction)
  - Barentswatch Sea Current (current speed, direction)
  - Kartverket Tideforecast (tide events)

## Error Handling

### Common HTTP Status Codes

| Status | Meaning | Retry |
|--------|---------|-------|
| 200 | Success | No |
| 201 | Created (registration successful) | No |
| 400 | Bad request (invalid parameters) | No |
| 401 | Unauthorized (missing/invalid API key) | No |
| 404 | Not found (no data for location) | Exponential backoff |
| 409 | Conflict (email already registered) | No |
| 429 | Rate limited | Use Retry-After header |
| 500 | Server error | Exponential backoff |

### Error Response Format

```json
{
  "success": false,
  "error": "Human-readable error message",
  "generated_at": "2026-05-09T12:34:56.789Z"
}
```

## Caching

The API implements server-side caching:

- **Score endpoint**: Cached for 30 minutes (1800s), stale for up to 1 hour
- **Tide endpoint**: Cached for 30 minutes (1800s), stale for up to 1 hour
- **Registration**: Cached for 1 hour (3600s)

Clients may implement additional caching based on the `Cache-Control` header.

## Data Sources & Attribution

The API integrates data from:

1. **MET Norway Locationforecast 2.0**: Weather data including temperature, wind, precipitation, pressure
2. **Barentswatch Waveforecast**: Sea state including wave height, period, direction
3. **Barentswatch Sea Current**: Water current speed and direction
4. **Kartverket Tide Forecast**: High and low tide events

All responses include `source_credit` field with proper attribution.

## Scoring Algorithm

The fishing score (0-100%) is calculated using depth-adaptive continuous functions based on:

1. Current speed (primary driver)
2. Wind & drift (safety override)
3. Tide phase (biological modifier)
4. Moon phase (tidal amplitude modifier)
5. Light & sun phase (dawn/dusk peak)
6. Wave height (safety & gear handling)
7. Precipitation
8. Sea temperature
9. Barometric pressure
10. Wave period (steep chop penalty)

**Safety Score**: Emphasizes boat handling conditions and storm safety thresholds  
**Fishing Score**: Emphasizes fish behavior and feeding conditions

The algorithm is depth-adaptive, tuning expectations for deep-water Norwegian coastal species (cod, saithe, ling, tusk).

## Best Practices

1. **Register once, cache your key**: Store your API key securely; there's no need to register repeatedly
2. **Respect rate limits**: Implement exponential backoff for 429 responses
3. **Cache responses**: Use server-side caching based on `Cache-Control` headers
4. **Handle 404s gracefully**: Some locations (inland) may not have tide/wave data
5. **Include attribution**: When displaying results, include the `source_credit` field

## Support & Issues

For API issues, contact: support@nofish.app

## Changelog

### v1.0.0 (May 2026)

- Initial release
- POST /api/v1/register for API key registration
- GET /api/v1/score for fishing score forecasts
- GET /api/v1/tide for tide event data
- Per-key rate limiting (10 req/min, 100 req/day)
- Per-IP registration rate limiting (10 req/min)
