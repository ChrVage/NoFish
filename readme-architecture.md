# NoFish — Architecture

> Project structure, component responsibilities, navigation model, and data flow.

---

## Project Structure

```
app/
  layout.tsx            # Root layout — metadata, CSP header (meta tag), JSON-LD structured data
  page.tsx              # Home page — full-screen interactive map
  globals.css           # Global styles (Tailwind base + custom scrollbar); light-mode only
  details/
    page.tsx            # Server component — 10-day hourly forecast table
    loading.tsx         # Streaming skeleton shown while server fetches data
  score/
    page.tsx            # Placeholder — fishing score coming soon
  tide/
    page.tsx            # Server component — high/low tide event table (10 days)
  api/
    geocoding/
      route.ts          # GET /api/geocoding?lat=&lon= — thin proxy to lib/api/geocoding.ts
    weather/
      route.ts          # GET /api/weather?lat=&lon= — returns forecasts + ocean grid coordinates

components/
  BackButton.tsx        # Client component — reads lat/lng/zoom from search params, navigates back to /?lat=&lng=&zoom=
  Footer.tsx            # "About NoFish" and "Feedback" links
  ForecastTable.tsx     # Hourly forecast table; columns grouped by API source; ocean columns hidden for inland points
  Map.tsx               # Leaflet map; click → marker + popup; parallel geo+weather fetch; blue ocean dot + line
  PageNav.tsx           # Header nav buttons (Score / Details / Tides); current page button is hidden

lib/
  api/
    weather.ts          # getCombinedForecast() — fetches and merges Locationforecast + Oceanforecast + Kartverket tides;
                        # exports CombinedForecastResult with ocean grid coords and tide station metadata;
                        # getTideForecast() for the tide-only page;
                        # solar elevation / sun phase calculation; tide phase labelling
    geocoding.ts        # reverseGeocode() — Nominatim with rich name fallback chain (village, bay, fjord, sea…)
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    lookups.ts          # insertLookup() + ensureTable() — DDL memoized per process lifetime
    cache.ts            # forecast_cache table — getCached() / setCached() / withInflight()
  utils/
    distance.ts         # haversineDistance(lat1,lng1,lat2,lng2) → km; formatDistance() → "1.2 km" / "350 m"
    timezone.ts         # getTimezone(lat,lng) → IANA name via tz-lookup; getTimezoneLabel() → "Europe/Oslo (GMT+2)"

public/                 # Static assets (OG image, favicons)
types/
  weather.ts            # TypeScript interfaces for MET Norway API responses, HourlyForecast, TideXMLResponse, etc.
```

---

## Navigation Model

All coordinate state lives in URL search params (`?lat=…&lng=…`). No global state, no context.

### Map popup buttons and PageNav

Both the Leaflet popup and the in-page header share the same three buttons:

| Button | Background | Route |
|---|---|---|
| Score | Green text / grey bg | `/score?lat=…&lng=…&zoom=…` |
| Details | White / ocean-blue | `/details?lat=…&lng=…&zoom=…` |
| Tides | White / blue | `/tide?lat=…&lng=…&zoom=…` |

The **current page’s button is hidden** in `PageNav`. The `zoom` param is appended by the map popup so the map zoom level can be restored when navigating back.

### Back navigation

`BackButton` reads `lat`, `lng`, and `zoom` from the current page’s search params and navigates to `/?lat=…&lng=…&zoom=…`. `Map.tsx` reads these on mount and:
1. Initialises the map at the saved center and zoom
2. After 150 ms (tiles loading), calls `openMarkerAt()` to place the marker and open the popup
3. `openMarkerAt()` also fires the parallel geo+weather fetch, so the blue ocean dot appears as normal

---

## Data Flow

### Map click → popup

```
User clicks map
  └─ Map.tsx (client)
       ├─ Parallel fetch:
       │    ├─ GET /api/geocoding?lat=&lon=
       │    │    └─ lib/api/geocoding.ts → cache hit? return / miss → Nominatim → cache (TTL 30 days)
       │    │         Name fallback: village → town → city → hamlet → bay → fjord → sea → display_name[0]
       │    └─ GET /api/weather?lat=&lon=
       │         └─ lib/api/weather.ts (getCombinedForecast)
       │              ├─ returns forecasts + oceanForecastLat/Lng
       │              └─ Map draws blue CircleMarker + dashed Polyline to ocean grid point
       └─ Popup shows location name (updates when fetch resolves)
            └─ Polyline and dot removed on popup close or page navigation
```

### Detail/Tide page (Server Component)

```
  Page server render
       ├─ lib/utils/timezone.ts → IANA timezone (pure JS via tz-lookup)
       ├─ lib/api/geocoding.ts   → cache hit / miss → Nominatim
       ├─ lib/api/weather.ts
       │    getCombinedForecast() → cache hit / miss → parallel:
       │         ├─ MET Norway Locationforecast 2.0 (weather, wind, precipitation…)
       │         ├─ MET Norway Oceanforecast 2.0   (waves, current, sea temp…)
       │         └─ Kartverket Tide API             (high/low events, XML parsed server-side)
       │    Returns: CombinedForecastResult
       │         ├─ forecasts[]        — merged HourlyForecast array
       │         ├─ forecastLat/Lng    — Locationforecast grid point
       │         ├─ oceanForecastLat/Lng — Oceanforecast grid point (undefined if inland)
       │         └─ tideStationName/Lat/Lng — nearest Kartverket station
       └─ after(): lib/db/lookups.ts → Neon (production only, non-blocking)
```

All outbound requests are made **server-side**. The browser only talks to `/api/*` on the same origin.

### withInflight deduplication

`withInflight(key, fn)` in `lib/db/cache.ts` ensures that if N concurrent requests arrive for the same cold-cache key, only one external fetch is fired. The others await the same promise and all receive the same result.

---

## ForecastTable Column Groups

The table has a two-row header. The top row spans columns by API source:

| Group | Columns | Condition |
|---|---|---|
| MET Norway Locationforecast | Weather icon, Wind (+ gust), Wind dir, Precip., Air temp | Always shown |
| MET Norway Oceanforecast | Wave height, Wave dir, Sea temp, Current speed, Current dir | Hidden if no `waveHeight` data |
| Kartverket | Tide phase | Hidden if no ocean data |
| Calculated | Sun phase | Always shown |

`hasOceanData` is derived client-side: `forecasts.some(f => f.waveHeight !== undefined)`. Inland points get a clean 5-column table.

---

## Cache Keys and TTLs

| Data | Key pattern | Precision | TTL |
|---|---|---|---|
| Geocoding | `geo3:{lat.2dp}:{lng.2dp}` | ≈1 km | 30 days |
| Weather + ocean | `weather:{lat.2dp}:{lng.2dp}` | ≈1 km | 1 hour |
| Tides | `tide:{lat.0dp}:{lng.0dp}` | Integer (Kartverket’s own precision) | 6 hours |

The `geo3:` prefix replaced earlier `geo2:` and `geo:` prefixes to invalidate stale entries that lacked water-body name fallbacks.

---

## Security

Set in `app/layout.tsx` as a `<meta>` tag:

| Mechanism | Notes |
|---|---|
| Content-Security-Policy | `script-src 'self' 'unsafe-inline'`; `img-src` allows OSM tile hosts; `connect-src 'self'` only |
| Referrer-Policy | `no-referrer-when-downgrade` |
| JSON-LD | `WebApplication` + `WeatherApplication` schema, genre `Fishing` |

> For header-level CSP enforcement (stronger), configure `next.config.ts` with `headers()`.

---

## Future Work

- [ ] Fishing Score algorithm (weather + tide + seasonal weighting)
- [ ] CSP promoted to HTTP response headers (`next.config.ts`)
- [ ] `error.tsx` boundary pages for `/details` and `/tide`
- [ ] `loading.tsx` streaming state for `/tide`
- [ ] Coordinate bounds validation (reject invalid lat/lng early)
- [ ] Sitemap and `robots.txt`
