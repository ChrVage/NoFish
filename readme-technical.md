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
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Wave height/direction, sea temperature, surface currents | JSON | None |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide event times and heights; 10-minute water level forecasts and observations | XML | None |
| [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/develop/api/Reverse/) | Reverse geocoding — coordinates → place name | JSON | None |

All external calls are made **server-side** to avoid CORS issues and comply with MET Norway's rate-limiting policy. A `User-Agent: NoFish/1.0 github.com/ChrVage/NoFish` header is sent with every request.

---

## API Routes

| Route | Purpose |
|---|---|
| `GET /api/geocoding?lat=&lon=` | Reverse geocodes coordinates via Nominatim. Returns place name with multi-level fallback. |
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
  oceanForecastLat?: number;         // Oceanforecast grid point (undefined if inland or > 1 km away)
  oceanForecastLng?: number;
  tideStationName?: string;          // Nearest Kartverket station (undefined when ocean data suppressed)
  tideStationLat?: number;
  tideStationLng?: number;
  metadata: Record<string, never>;
}
```

### `HourlyForecast` (`types/weather.ts`)

Merged per-hour record combining Locationforecast, Oceanforecast, tide phase, and sun phase fields. Ocean fields (`waveHeight`, `waveDirection`, `seaTemperature`, `currentSpeed`, `currentDirection`) and tide fields (`tideHeight`, `tidePhase`) are `undefined` when the ocean forecast grid point is more than 1 km from the requested location.

---

## Utilities

| Utility | File | Description |
|---|---|---|
| `haversineDistance(lat1,lng1,lat2,lng2)` | `lib/utils/distance.ts` | Great-circle distance in km |
| `formatDistance(km)` | `lib/utils/distance.ts` | Human-readable: `"1.2 km"` or `"350 m"` |
| `getTimezone(lat,lng)` | `lib/utils/timezone.ts` | IANA timezone string via tz-lookup, falls back to `UTC` |
| `getTimezoneLabel(tz)` | `lib/utils/timezone.ts` | `"Europe/Oslo (GMT+2)"` — uses `Intl` for correct DST |

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

> See [readme-architecture.md](readme-architecture.md) for project structure and data flow.
> See [readme-dataquality.md](readme-dataquality.md) for data source accuracy ratings.
