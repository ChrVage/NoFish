# NoFish Public API v1 - Testing Guide

## Quick Start - Step by Step

### Step 1: Register for an API Key

Register with a test email:

```bash
curl -X POST https://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected response (201 Created):
```json
{
  "success": true,
  "key": "abcdef0123456789...",
  "email": "test@example.com",
  "generated_at": "2026-05-09T12:34:56.789Z"
}
```

Save the `key` value for use in subsequent requests.

### Step 2: Query Fishing Score for Oslo Fjord

Use the API key from Step 1 in the `X-Api-Key` header:

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY_FROM_STEP_1"
```

### Step 3: Query Tide Information

```bash
curl "https://localhost:3000/api/v1/tide?lat=59.91&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY_FROM_STEP_1"
```

## Testing Scenarios

### Test 1: Happy Path - Valid Score Request

```bash
# Request with all optional parameters
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75&boat=25-30&fish=cod&method=rod&depth=80" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 200 OK with best_windows and hourly_scores

### Test 2: Missing API Key

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75"
```

Expected: 401 Unauthorized
```json
{
  "success": false,
  "error": "Missing X-Api-Key header",
  "generated_at": "..."
}
```

### Test 3: Invalid API Key

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: invalid-key-format"
```

Expected: 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid API key format",
  "generated_at": "..."
}
```

### Test 4: Invalid Coordinates

```bash
curl "https://localhost:3000/api/v1/score?lat=invalid&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 400 Bad Request

### Test 5: Missing Coordinates

```bash
curl "https://localhost:3000/api/v1/score" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 400 Bad Request

### Test 6: Inland Location (No Wave Data)

Oslo is inland, so it may not have tide/wave data:

```bash
curl "https://localhost:3000/api/v1/tide?lat=59.9139&lon=10.7522" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 404 Not Found (or empty events array)

### Test 7: Coastal Location with Full Data

Bergen (Norwegian west coast):

```bash
curl "https://localhost:3000/api/v1/score?lat=60.3887&lon=5.3271" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 200 OK with comprehensive data

```bash
curl "https://localhost:3000/api/v1/tide?lat=60.3887&lon=5.3271" \
  -H "X-Api-Key: YOUR_API_KEY"
```

Expected: 200 OK with tide events

### Test 8: Rate Limiting

Make 11 requests within 60 seconds (limit is 10/min):

```bash
for i in {1..11}; do
  curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
    -H "X-Api-Key: YOUR_API_KEY"
  echo "Request $i"
done
```

Expected: 11th request returns 429 Too Many Requests with Retry-After header

### Test 9: Email Already Registered

```bash
# First registration succeeds
curl -X POST https://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"duplicate@example.com"}'

# Second registration with same email fails
curl -X POST https://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"duplicate@example.com"}'
```

Second request expected: 409 Conflict
```json
{
  "success": false,
  "error": "Email already registered. Contact support for a new key.",
  "generated_at": "..."
}
```

### Test 10: Invalid Email Format

```bash
curl -X POST https://localhost:3000/api/v1/register \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
```

Expected: 400 Bad Request

## Test Data - Popular Fishing Locations

```bash
# Lofoten Islands (famous fishing destination)
LAT=68.6945
LON=14.3712

# Sognefjord
LAT=60.9839
LON=7.0169

# Hardangerfjord
LAT=60.1439
LON=6.5667

# Geirangerfjord
LAT=62.1032
LON=7.2168

# Oslofjord
LAT=59.91
LON=10.75

# Trondheimsfjord
LAT=63.8367
LON=11.2500
```

## Using in JavaScript/Node.js

```javascript
const API_KEY = 'your-api-key-here';
const BASE_URL = 'https://nofish.app/api/v1';

// Get fishing score
async function getScore(lat, lon, options = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    ...options
  });
  
  const response = await fetch(`${BASE_URL}/score?${params}`, {
    headers: {
      'X-Api-Key': API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return response.json();
}

// Get tide information
async function getTide(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  
  const response = await fetch(`${BASE_URL}/tide?${params}`, {
    headers: {
      'X-Api-Key': API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return response.json();
}

// Usage
(async () => {
  const score = await getScore(59.91, 10.75, { boat: '25-30', fish: 'cod' });
  console.log('Best windows:', score.best_windows);
  
  const tide = await getTide(59.91, 10.75);
  console.log('Tide events:', tide.events);
})();
```

## Using in Python

```python
import requests
import json

API_KEY = 'your-api-key-here'
BASE_URL = 'https://nofish.app/api/v1'

def get_score(lat, lon, boat=None, fish=None, method=None, depth=None):
    params = {'lat': lat, 'lon': lon}
    if boat: params['boat'] = boat
    if fish: params['fish'] = fish
    if method: params['method'] = method
    if depth: params['depth'] = depth
    
    response = requests.get(
        f'{BASE_URL}/score',
        params=params,
        headers={'X-Api-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()

def get_tide(lat, lon):
    response = requests.get(
        f'{BASE_URL}/tide',
        params={'lat': lat, 'lon': lon},
        headers={'X-Api-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()

# Usage
score = get_score(59.91, 10.75, boat='25-30', fish='cod')
print('Best windows:', score['best_windows'])

tide = get_tide(59.91, 10.75)
print('Tide events:', tide['events'])
```

## Monitoring & Debugging

### Check API Key is Valid

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -v
```

Look for `X-Api-Key` in request headers and 200/401 status code.

### Check Rate Limit Headers

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -i | grep X-RateLimit
```

### Check Cache Status

```bash
curl "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75" \
  -H "X-Api-Key: YOUR_API_KEY" \
  -i | grep Cache-Control
```

Should show: `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`

## Postman Collection

Import this into Postman for easy testing:

```json
{
  "info": {
    "name": "NoFish API v1",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register API Key",
      "request": {
        "method": "POST",
        "url": "https://localhost:3000/api/v1/register",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@example.com\"}"
        }
      }
    },
    {
      "name": "Get Score",
      "request": {
        "method": "GET",
        "url": "https://localhost:3000/api/v1/score?lat=59.91&lon=10.75",
        "header": [{"key": "X-Api-Key", "value": "YOUR_API_KEY"}]
      }
    },
    {
      "name": "Get Tide",
      "request": {
        "method": "GET",
        "url": "https://localhost:3000/api/v1/tide?lat=59.91&lon=10.75",
        "header": [{"key": "X-Api-Key", "value": "YOUR_API_KEY"}]
      }
    }
  ]
}
```
