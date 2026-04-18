# NoFish — Technical Documentation

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, server components, `after()`) |
| Language | TypeScript 5 |
| Runtime | React 19.2.3 |
| Styling | Tailwind CSS v4 (light-mode only — dark-mode OS preference intentionally ignored) |
| Map | Leaflet.js 1.9.4 (loaded client-side via `useEffect`; SSR-disabled with `next/dynamic`) with OpenStreetMap tiles |
| XML parsing | `fast-xml-parser` — used to parse Kartverket's tide API XML response server-side |
| Database | Neon serverless Postgres via `@neondatabase/serverless` |
| Timezone | `tz-lookup` 6.1.25 — pure-JS IANA timezone from coordinates; no file I/O; works on Vercel Edge |
| Deployment | Vercel (auto-deploy on push to `main`) |

---

## External APIs

| API | Purpose | Format | Auth |
|---|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Wind, temperature, precipitation, pressure, cloud cover | JSON | None |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Sea surface temperature | JSON | None |
| [Barentswatch Waveforecast](https://developer.barentswatch.no/) | Wave height/direction | JSON | OAuth2 client credentials |
| [Barentswatch Sea Current](https://developer.barentswatch.no/) | Current speed/direction | JSON | OAuth2 client credentials |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide event times and heights; 10-minute water level forecasts and observations | XML | None |
| [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/develop/api/Reverse/) | Reverse geocoding — coordinates → place name | JSON | None |

All external calls are made **server-side** to avoid CORS issues and comply with MET Norway's rate-limiting policy. A `User-Agent: NoFish/1.0 github.com/ChrVage/NoFish` header is sent with every request.

---

## API Routes

| Route | Purpose |
|---|---|
| `GET /api/geocoding?lat=&lon=` | Reverse geocodes coordinates using "Maritime First" strategy (v9): parallel elevation + Kartverket SSR nearby-places fetch, maritime features prioritised for coastal locations, municipality from Kartverket `/sted` endpoint. Nominatim used only as fallback for non-Norwegian locations. Returns place name, elevation, terrain type, sea/land classification, and kommune number. 30-day cacheKartverket SSR nearby-places fetch, maritime features prioritised for coastal locations, municipality from Kartverket `/sted` endpoint. Nominatim used only as fallback for non-Norwegian locations. Returns place name, elevation, terrain type, sea/land classification, and kommune number. 30-day cache. |
| `GET /api/weather?lat=&lon=` | Returns the full 10-day merged `HourlyForecast[]` array plus ocean grid coordinates. Used by the Details, Score, and Tide pages via server-side direct lib calls; this route is exposed for external consumers. |
| `GET /api/ocean-point?lat=&lon=` | Returns only `{ oceanForecastLat, oceanForecastLng }`. Used by the map to place the blue dot and determine whether Score/Tide buttons should be shown. Returns `undefined` coordinates when the grid point is more than 1 km away. Cache-backed \u2014 usually a hit when the Details page has already been visited. |

All three routes validate coordinate bounds (`lat` ∈ [−90, 90], `lon` ∈ [−180, 180]) and return `400` for out-of-range or non-numeric inputs.

---

## Key Interfaces

### `CombinedForecastResult` (`lib/api/weather.ts`)

```typescript
interface CombinedForecastResult {
  forecasts: HourlyForecast[];       // merged hourly array
  forecastLat: number;               // Locationforecast grid point
  forecastLng: number;
  oceanForecastLat?: number;         // Barentswatch wave grid point (undefined if inland or > 1 km away)
  oceanForecastLng?: number;
  waveForecastSource?: 'barentswatch'; // set when wave data comes from Barentswatch
  tideStationName?: string;          // Nearest Kartverket station (undefined when ocean data suppressed)
  tideStationLat?: number;
  tideStationLng?: number;
  metadata: Record<string, never>;
}
```

### `HourlyForecast` (`types/weather.ts`)

Merged per-hour record combining Locationforecast, Barentswatch wave/current, Oceanforecast (sea temp), tide phase, and sun phase fields. Ocean fields (`waveHeight`, `waveDirection`, `currentSpeed`, `currentDirection`) come from Barentswatch. `seaTemperature` comes from MET Oceanforecast. Tide fields (`tideHeight`, `tidePhase`) are `undefined` when the wave forecast grid point is more than 1 km from the requested location.

---

## Utilities

| Utility | File | Description |
|---|---|---|
| `haversineDistance(lat1,lng1,lat2,lng2)` | `lib/utils/distance.ts` | Great-circle distance in km |
| `formatDistance(km)` | `lib/utils/distance.ts` | Human-readable: `"1.2 km"` or `"350 m"` |
| `getTimezone(lat,lng)` | `lib/utils/timezone.ts` | IANA timezone string via tz-lookup, falls back to `UTC` |
| `getTimezoneLabel(tz)` | `lib/utils/timezone.ts` | `"Europe/Oslo (GMT+2)"` — uses `Intl` for correct DST |
| `enrichForecasts(forecasts)` | `lib/utils/enrichForecasts.ts` | Trims at last hourly MET row; interpolates Barentswatch 3-h wave data to fill every hour |

---

## Database (Neon)

Two tables share the same Neon project. Both are created automatically on first use.

### `lookups` — usage log

Logged **in production only** (`NODE_ENV === 'production'`), after the response is sent (`after()`), so it never adds latency.

| Column | Type | Description |
|---|---|---|
| `id` | serial | Primary key |
| `lat` / `lon` | double precision | Clicked coordinates |
| `location_name` | text | Reverse-geocoded place name |
| `municipality` / `county` | text | Administrative names |
| `ip_address` | text | Client IP (`x-forwarded-for`) |
| `user_agent` | text | Browser/OS string |
| `geo_country` / `geo_region` / `geo_city` | text | Vercel geo headers |
| `created_at` | timestamptz | UTC timestamp (auto-set) |

### `forecast_cache` — API response cache

| Column | Description |
|---|---|
| `cache_key` | Text primary key — e.g. `geo3:59.91:10.75`, `weather:59.91:10.75`, `tide:60:11`, `tideall:60:11` |
| `data` | JSONB — full serialised API response |
| `cached_at` | Write timestamp |
| `expires_at` | Expiry timestamp; stale rows are overwritten on next miss |

### Setup

1. Create a Neon project at [neon.com](https://neon.com) or connect via **Vercel → Storage → Neon** (auto-adds `DATABASE_URL`).
2. Add to `.env.local`:
   ```
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   ```
3. Both tables are created automatically on first cold start via `ensureTable()` (DDL is memoized per process — runs at most once).

> **Without `DATABASE_URL`** the app throws on startup. To run without a database, stub `insertLookup` as a no-op and remove the cache calls.

---

## Development

**Prerequisites:** Node.js 20+, npm 10+

**Windows** — if you hit execution policy errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

```bash
git clone https://github.com/ChrVage/NoFish.git
cd NoFish
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
npm run lint
```

---

## Deployment (Vercel)

Live at [nofish.no](https://nofish.no). Pushes to `main` trigger automatic redeployment.

**Required env var:** `DATABASE_URL`

**Via Vercel Dashboard**
1. Import your fork at [vercel.com/new](https://vercel.com/new)
2. Connect Neon under **Storage → Connect Store** to auto-add `DATABASE_URL`
3. Deploy

**Via CLI**
```bash
npm install -g vercel
vercel env add DATABASE_URL production
vercel --prod
```

---

## SSL Certificate

Vercel automatically provisions and renews a Let's Encrypt TLS certificate for every custom domain. If the site shows `NET::ERR_CERT_AUTHORITY_INVALID` or a browser HSTS warning:

1. Go to [vercel.com](https://vercel.com) → your project → **Settings → Domains**
2. Check that `nofish.no` shows a green **Valid Configuration** status
3. If the domain shows a warning, follow the steps shown to re-verify DNS ownership
4. Once DNS is correct, Vercel will automatically re-issue the certificate (usually within minutes)

> **⚠️ Important:** The app sets `Strict-Transport-Security: max-age=63072000; includeSubDomains` on every response. This means browsers will enforce HTTPS for 2 years after the first visit. **Always verify that a valid certificate is in place (step 1–3 above) before deploying changes that affect security headers.**

---

---

# Architecture

> Project structure, component responsibilities, navigation model, and data flow.

---

## Project Structure

```
app/
  layout.tsx            # Root layout — metadata, JSON-LD structured data
  page.tsx              # Home page — full-screen interactive map
  globals.css           # Global styles (Tailwind base + custom scrollbar); light-mode only
  about/
    page.tsx            # About NoFish — purpose and usage
  data/
    page.tsx            # Data column reference and source quality
  score/
    about/
      page.tsx          # Fishing score algorithm documentation
  details/
    page.tsx            # Server component — 10-day hourly forecast table
    loading.tsx         # Streaming skeleton shown while server fetches data
  score/
    page.tsx            # Server component — fishing score table (0–100%) with per-hour ratings
  tide/
    page.tsx            # Server component — high/low tide event table (10 days)
  api/
    geocoding/
      route.ts          # GET /api/geocoding?lat=&lon= — thin proxy to lib/api/geocoding.ts
    weather/
      route.ts          # GET /api/weather?lat=&lon= — returns full HourlyForecast[] + ocean grid coordinates
    ocean-point/
      route.ts          # GET /api/ocean-point?lat=&lon= — returns only oceanForecastLat/Lng (used by map)

components/
  BackButton.tsx        # Client component — reads lat/lng/zoom from search params, navigates back to /?lat=&lng=&zoom=
  Footer.tsx            # Inline button bar on sub-pages — "About NoFish" and "Feedback" links
  ForecastTable.tsx     # Hourly forecast table; columns grouped by API source
  Map.tsx               # Leaflet map; click → marker + popup
  PageNav.tsx           # Header nav buttons (Score / Details / Tides)

lib/
  api/
    barentswatch.ts     # OAuth2 token management + getWaveForecast() + getSeaCurrentForecast()
    weather.ts          # getCombinedForecast() — fetches and merges all API sources
    geocoding.ts        # reverseGeocode() — "Maritime First" v9: Kartverket SSR + elevation, maritime features prioritised, Nominatim fallbacklevation, maritime features prioritised, Nominatim fallback
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    lookups.ts          # insertLookup() + ensureTable()
    cache.ts            # forecast_cache table — getCached() / setCached() / withInflight()
  utils/
    distance.ts         # haversineDistance / formatDistance
    timezone.ts         # getTimezone / getTimezoneLabel via tz-lookup
    enrichForecasts.ts  # Trims at last hourly MET row; interpolates Barentswatch 3-h wave data

public/                 # Static assets (OG image, favicons)
types/
  weather.ts            # TypeScript interfaces for API responses, HourlyForecast, etc.
```

---

## Navigation Model

All coordinate state lives in URL search params (`?lat=…&lng=…`). No global state, no context.

### Map popup buttons and PageNav

| Button | Route | Condition |
|---|---|---|
| Score | `/score?lat=…&lng=…&zoom=…` | Ocean data available (grid point ≤ 1 km) |
| Details | `/details?lat=…&lng=…&zoom=…` | Always shown |
| Tides | `/tide?lat=…&lng=…&zoom=…` | Ocean data available (grid point ≤ 1 km) |

The current page's button is shown as a non-clickable grey span in `PageNav`. Score and Tides are hidden when the ocean forecast grid point is more than 1 km away.

### Back navigation

`BackButton` reads `lat`, `lng`, and `zoom` from the current page's search params and navigates to `/?lat=…&lng=…&zoom=…`. On detail pages it is rendered as the `🎣 NoFish` logo — the entire logo is the back button.

---

## Data Flow

### Map click → popup

```
User clicks map
  └─ Map.tsx (client)
       ├─ Parallel fetch:
       │    ├─ GET /api/geocoding?lat=&lon=
       │    └─ GET /api/ocean-point?lat=&lon=
       └─ Popup shows location name, blue dot + line to ocean grid point
```

### Detail/Tide page (Server Component)

```
  Page server render
       ├─ lib/utils/timezone.ts → IANA timezone
       ├─ lib/api/geocoding.ts → cache hit / miss → Nominatim
       ├─ lib/api/weather.ts
       │    getCombinedForecast() → parallel:
       │         ├─ MET Norway Locationforecast 2.0
       │         ├─ Barentswatch Waveforecast (OAuth2)
       │         ├─ Barentswatch Sea Current (OAuth2)
       │         ├─ MET Norway Oceanforecast 2.0 (sea temp)
       │         └─ Kartverket Tide API (XML)
       │    Returns: CombinedForecastResult
       └─ after(): lib/db/lookups.ts → Neon (production only)
```

### withInflight deduplication

`withInflight(key, fn)` ensures only one external fetch fires for N concurrent requests with the same cold-cache key.

---

## Cache Keys and TTLs

| Data | Key pattern | Precision | TTL |
|---|---|---|---|
| Geocoding | `geo3:{lat.2dp}:{lng.2dp}` | ≈1 km | 30 days |
| Weather + ocean | `weather:{lat.2dp}:{lng.2dp}` | ≈1 km | 1 hour |
| Tides (events) | `tide:{lat.0dp}:{lng.0dp}` | Integer | 6 hours |
| Tides (page data) | `tideall:{lat.0dp}:{lng.0dp}` | Integer | 6 hours |

---

## Security

Set in `next.config.ts` via `headers()`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `img-src` allows OSM tile hosts; `connect-src 'self'` only |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer-when-downgrade` |
