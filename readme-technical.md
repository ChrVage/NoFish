# NoFish — Technical Documentation

---

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, server components, `after()`) |
| Language | TypeScript 5 |
| Runtime | React 19.2.3 |
| Internationalisation | `next-intl` 4 — locale-prefixed routing for `no` (default), `en`, `de`, `nl`, `pl` via `middleware.ts` + `i18n/routing.ts` |
| Styling | Tailwind CSS v4 (light-mode only — dark-mode OS preference intentionally ignored) |
| Map | Leaflet.js 1.9.4 (loaded client-side via `useEffect`; SSR-disabled with `next/dynamic`) with OpenStreetMap tiles |
| XML parsing | `fast-xml-parser` — used to parse Kartverket's tide API XML response server-side |
| Database | Neon serverless Postgres via `@neondatabase/serverless` |
| Timezone | `tz-lookup` 6.1.25 — pure-JS IANA timezone from coordinates; no file I/O; works on Vercel Edge |
| Testing | Vitest 4 (`npm test` / `npm run test:watch`) |
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
| `GET /api/geocoding?lat=&lon=` | Reverse geocodes coordinates using "Maritime First" strategy (v9): parallel elevation + Kartverket SSR nearby-places fetch, maritime features prioritised for coastal locations, municipality from Kartverket `/sted` endpoint. Nominatim used only as fallback when Kartverket cannot supply a municipality (typically non-Norwegian locations). Returns place name, elevation, terrain type, sea/land classification, and kommune number. 30-day cache. Rate-limited (60 req/min/IP). |
| `GET /api/weather?lat=&lon=` | Returns the full 10-day merged `HourlyForecast[]` array plus ocean grid coordinates. Used by the Details, Score, and Tide pages via server-side direct lib calls; this route is exposed for external consumers. Rate-limited (30 req/min/IP). |
| `GET /api/weather-point?lat=&lon=` | Returns only `{ weatherForecastLat, weatherForecastLng }`. Used by the map to determine the MET Norway grid point snapped to the request. Rate-limited (60 req/min/IP). |
| `GET /api/ocean-point?lat=&lon=` | Returns only `{ oceanForecastLat, oceanForecastLng }`. Used by the map to place the blue dot and determine whether Score/Tide buttons should be shown. Returns `undefined` coordinates when the grid point is more than 1 km away. Rate-limited (60 req/min/IP). Cache-backed — usually a hit when the Details page has already been visited. |
| `GET /api/search?q=` | Place name search via Kartverket Stedsnavn API. Returns up to 6 results with name, type, municipality, and coordinates. Fuzzy wildcard matching. Rate-limited (30 req/min/IP); cached 24 h. |
| `GET /api/statistics` | Aggregate usage counts from the `lookups` table — total lookups, weekly series, today/7-day KPIs, top cities. Powers `/statistics` page. Rate-limited (10 req/min/IP); 5-minute ISR cache. |
| `POST /api/v1/register` | Public-API key registration. Generates a 64-hex-char API key bound to an email. Per-IP rate limit (10 req/min). Returns 409 if the email is already registered. |
| `GET /api/v1/score?lat=&lon=` | Authenticated public-API endpoint (`X-Api-Key` header). Returns `best_windows` and `hourly_scores`. Per-key rate limit (10 req/min, 100 req/day). 30 min `s-maxage`, 1 h stale-while-revalidate. |
| `GET /api/v1/tide?lat=&lon=` | Authenticated public-API endpoint (`X-Api-Key` header). Returns high/low tide events for the nearest Kartverket station. Same per-key rate limits and cache headers as `/api/v1/score`. |


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
| `buildLocationUrl(page, params)` | `lib/utils/params.ts` | Builds typed URL strings for all sub-pages with lat/lng/zoom/boat/fish/method params |
| `validateCoordinates(lat, lon)` | `lib/utils/validation.ts` | Parses and clamps lat/lng from request params; returns `NextResponse` 400 on invalid input |
| `checkRateLimit(request, opts)` | `lib/utils/rateLimit.ts` | In-memory sliding-window rate limiter for API routes |
| `getSunPhaseStyle(segments)` | `lib/utils/sunPhaseStyle.ts` | Returns CSS background gradient for sun phase (dawn/day/dusk/night) |
| `computeFishingScore(f, options)` | `lib/scoring/fishingScore.ts` | Per-hour 0–100 fishing score with safety/fishing split; species-aware |
| `findBestWindows(scored, options)` | `lib/scoring/fishingScore.ts` | Finds up to 2 best non-overlapping windows; method-aware (net uses 6–8 h overnight logic) |
| `recommendFishingMethods(scored, tz, fish)` | `lib/scoring/fishingScore.ts` | Returns ranked method recommendations for the forecast period |
| `FISH_TARGET_GROUPS` | `lib/utils/tuning.ts` | Species grouped by scoring depth tier (< 100 m / 100–200 m / > 200 m); `FISH_TARGET_OPTIONS` is derived from these groups |

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
| `cache_key` | Text primary key — e.g. `geo9:59.9133:10.7522`, `weather:59.91:10.75`, `tide:60:11`, `tideall:60:11` |
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
  layout.tsx            # Root layout — passes children through to the locale layout
  globals.css           # Global styles (Tailwind base + custom scrollbar); light-mode only
  robots.ts             # /robots.txt — points crawlers at the sitemap
  sitemap.ts            # /sitemap.xml — generated from the static route list
  [locale]/
    layout.tsx          # Per-locale layout — metadata (icons, OG, manifest), JSON-LD structured data, NextIntlClientProvider
    page.tsx            # Home page — full-screen interactive map
    error.tsx           # Locale-scoped client error boundary
    about/
      page.tsx          # About NoFish — purpose and usage
    data/
      page.tsx          # Data column reference and source quality
    details/
      page.tsx          # Server component — 10-day hourly forecast table
      loading.tsx       # Streaming skeleton shown while server fetches data
      error.tsx         # Error boundary for the Details page
    score/
      page.tsx          # Server component — fishing score table (0–100%) with per-hour ratings
      loading.tsx       # Streaming skeleton
      error.tsx         # Error boundary for the Score page
      about/
        page.tsx        # Fishing score algorithm documentation
    tide/
      page.tsx          # Server component — high/low tide event table (10 days)
      loading.tsx       # Streaming skeleton
      error.tsx         # Error boundary for the Tide page
    statistics/
      page.tsx          # Server component — aggregate usage charts (ISR, 5-minute revalidation)
      loading.tsx       # Streaming skeleton
      error.tsx         # Error boundary
    feedback/
      page.tsx          # Client component — collect flagged data points and open GitHub issue
  api/
    geocoding/
      route.ts          # GET /api/geocoding?lat=&lon= — thin proxy to lib/api/geocoding.ts
      route.test.ts
    weather/
      route.ts          # GET /api/weather?lat=&lon= — returns full HourlyForecast[] + ocean grid coordinates
    weather-point/
      route.ts          # GET /api/weather-point?lat=&lon= — returns only weatherForecastLat/Lng (used by map)
    ocean-point/
      route.ts          # GET /api/ocean-point?lat=&lon= — returns only oceanForecastLat/Lng (used by map)
      route.test.ts
    search/
      route.ts          # GET /api/search?q= — place name search via Kartverket Stedsnavn
    statistics/
      route.ts          # GET /api/statistics — aggregate usage stats (rate-limited)
    v1/
      register/
        route.ts        # POST /api/v1/register — public-API key registration
      score/
        route.ts        # GET /api/v1/score — authenticated public-API fishing score endpoint
      tide/
        route.ts        # GET /api/v1/tide — authenticated public-API tide endpoint

middleware.ts           # next-intl middleware — handles locale prefix on every non-API route
next.config.ts          # Next config, security headers (CSP, HSTS, …), next-intl plugin wiring
i18n/
  routing.ts            # next-intl locale list (no/en/de/nl/pl) and default-locale config
  navigation.ts         # next-intl typed Link / useRouter / redirect helpers
  request.ts            # Server-side locale message loader

messages/               # Translated UI strings — en.json, no.json

components/
  BackButton.tsx        # Client component — reads lat/lng/zoom from search params, navigates back to /?lat=&lng=&zoom=
  BookingBanner.tsx     # Server component — renders active calendar booking for a previously booked fishing slot
  BookingButton.tsx     # Client component — adds a fishing slot to the device calendar (ICS download)
  ErrorFallback.tsx     # Client error boundary fallback — generic error message with retry
  FeedbackBanner.tsx    # Server component — shows a feedback prompt after a booking
  FeedbackButton.tsx    # Client component — opens feedback modal for a specific forecast row
  Footer.tsx            # Inline button bar on sub-pages — "About NoFish", "Data Reference", and "Feedback" links
  ForecastTable.tsx     # Hourly forecast table; columns grouped by API source; wind direction shown as met. wind barb
  HashScroller.tsx      # Client component — scrolls to the URL hash anchor on page load
  Header.tsx            # Top bar shared across all pages
  LocaleSwitcher.tsx    # Client component — language picker rendered in the header
  Logo.tsx              # 🎣 NoFish logo — also serves as back-to-map button
  Map.tsx               # Leaflet map; click → marker + popup
  PageNav.tsx           # Header nav buttons (Score / Details / Tides)
  SafetyContacts.tsx    # Emergency contacts list (HRS, VHF channel 16) shown on Score page
  TuningControls.tsx    # Client component — boat size, target species (grouped by depth), and fishing method selects

hooks/
  pre-commit            # Updates lib/version.json with the current commit count
  pre-push              # Runs typecheck, lint and tests; blocks the push on failure

lib/
  version.json          # `{ "commits": N }` — committed build version, refreshed by the pre-commit hook
  api/
    apiKeyValidator.ts  # validateApiKeyHeader() + recordApiRequest() — used by /api/v1/* routes
    barentswatch.ts     # OAuth2 token management + getWaveForecast() + getSeaCurrentForecast()
    fiskeridirektoratet.ts # queryProtectionZones() — fishing protection zones from Fiskeridirektoratet
    geocoding.ts        # reverseGeocode() — "Maritime First" v9: Kartverket SSR + elevation, maritime features prioritised, Nominatim fallback
    weather.ts          # getCombinedForecast() — fetches and merges all API sources
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    cache.ts            # forecast_cache table — getCached() / setCached() / withInflight()
    lookups.ts          # insertLookup() + ensureTable() for the usage log
    apiKeys.ts          # registerApiKey() / validateApiKey() / getKeyRequestCount() / incrementKeyRequestCount()
  scoring/
    fishingScore.ts     # computeFishingScore(), findBestWindows(), findNetFishingWindows(), recommendFishingMethods()
    fishingScore.test.ts
  utils/
    distance.ts         # haversineDistance / formatDistance
    enrichForecasts.ts  # Trims at last hourly MET row; interpolates Barentswatch 3-h wave data
    formatTime.ts       # Locale-aware date/time formatting helpers
    params.ts           # buildLocationUrl() — typed URL builder for all sub-pages
    rateLimit.ts        # checkRateLimit() + checkApiKeyRateLimit() — in-memory sliding-window rate limiter
    sunPhaseStyle.ts    # getSunPhaseStyle() — CSS gradient for sun phase column
    timezone.ts         # getTimezone / getTimezoneLabel via tz-lookup
    tuning.ts           # FISH_TARGET_GROUPS, FISH_TARGET_OPTIONS, FISHING_METHOD_OPTIONS, BOAT_SIZE_OPTIONS, TuningSelection type
    validation.ts       # validateCoordinates() — parses and clamps lat/lng at API boundary

public/                 # Static assets (logo, favicons, OG image, web manifest)
types/
  weather.ts            # TypeScript interfaces for API responses, HourlyForecast, etc.
```

---

## Logos and Icons

All branding assets live in [public/](public/) so Next.js serves them from the site root. URLs are cache-busted with a `?v=YYYYMMDD` query string in [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — bump that value whenever any of these files change.

### Required image files

| File | Purpose | Dimensions | Format | Background | Notes |
|---|---|---|---|---|---|
| [public/NoFish-logo.png](public/NoFish-logo.png) | In-app logo (header, loading screens). Rendered at 32×32 inside `rounded-full`. | 512×512 (square, ≥ 2× display size for retina) | PNG | Transparent | Master logo. Used by `next/image`, so larger source is fine — Next.js will downscale. |
| [public/favicon.ico](public/favicon.ico) | Legacy browser tab/bookmark icon. | Multi-resolution: 16×16, 32×32, 48×48 | ICO | Transparent | Bundled into a single `.ico` file. |
| [public/favicon.svg](public/favicon.svg) | Modern scalable browser tab icon. | Any (vector); designed at 32×32 | SVG | Transparent | Preferred by modern browsers; should look crisp at small sizes. |
| [public/favicon-96x96.png](public/favicon-96x96.png) | PNG fallback favicon for older browsers / Android Chrome tab. | 96×96 | PNG | Transparent | Square. |
| [public/apple-touch-icon.png](public/apple-touch-icon.png) | iOS / iPadOS home-screen icon. | 180×180 | PNG | Opaque (iOS masks corners) | No transparency — iOS adds rounded mask. |
| [public/web-app-manifest-192x192.png](public/web-app-manifest-192x192.png) | PWA / Android home-screen icon (standard density). | 192×192 | PNG | Opaque | Referenced from `site.webmanifest`. |
| [public/web-app-manifest-512x512.png](public/web-app-manifest-512x512.png) | PWA splash / high-density Android icon. | 512×512 | PNG | Opaque | Referenced from `site.webmanifest`. |
| `public/site.webmanifest` | PWA manifest pointing to the two `web-app-manifest-*.png` files. | — | JSON | — | Not an image, but required by the `manifest` metadata field. |
| `public/marine-weather-security-forecast-og.jpg` | Open Graph / Twitter card preview image. | 1200×630 | JPG | Opaque | Used when the site is shared on social media. |

### Where each file is referenced

| File | Referenced from |
|---|---|
| [public/NoFish-logo.png](public/NoFish-logo.png) | [components/Logo.tsx](components/Logo.tsx), [app/\[locale\]/page.tsx](app/[locale]/page.tsx), [app/\[locale\]/score/loading.tsx](app/[locale]/score/loading.tsx), [app/\[locale\]/details/loading.tsx](app/[locale]/details/loading.tsx), [app/\[locale\]/tide/loading.tsx](app/[locale]/tide/loading.tsx) |
| [public/favicon.ico](public/favicon.ico) | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.icons.icon` and `metadata.icons.shortcut` |
| [public/favicon.svg](public/favicon.svg) | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.icons.icon` |
| [public/favicon-96x96.png](public/favicon-96x96.png) | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.icons.icon` |
| [public/apple-touch-icon.png](public/apple-touch-icon.png) | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.icons.apple` |
| [public/web-app-manifest-192x192.png](public/web-app-manifest-192x192.png) | `public/site.webmanifest` (via `metadata.manifest` in [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx)) |
| [public/web-app-manifest-512x512.png](public/web-app-manifest-512x512.png) | `public/site.webmanifest` (via `metadata.manifest` in [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx)) |
| `public/site.webmanifest` | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.manifest` |
| `public/marine-weather-security-forecast-og.jpg` | [app/\[locale\]/layout.tsx](app/[locale]/layout.tsx) — `metadata.openGraph.images` and `metadata.twitter.images` |

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
| Geocoding | `geo9:{lat.4dp}:{lng.4dp}` | ≈11 m | 30 days |
| Weather + ocean | `weather:{lat.2dp}:{lng.2dp}` | ≈1 km | 1 hour |
| Tides (events) | `tide:{lat.0dp}:{lng.0dp}` | Integer degree | 6 hours |
| Tides (page data) | `tideall:{lat.0dp}:{lng.0dp}` | Integer degree | 6 hours |

---

## Security

Set in `next.config.ts` via `headers()`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `img-src` allows OSM tile hosts; `connect-src 'self'` only |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (2 years, enforces HTTPS) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer-when-downgrade` |
