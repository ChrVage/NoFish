# NoFish — Architecture

> Project structure, component responsibilities, navigation model, and data flow.

---

## Project Structure

```
app/
  layout.tsx            # Root layout — metadata, JSON-LD structured data
  page.tsx              # Home page — full-screen interactive map
  globals.css           # Global styles (Tailwind base + custom scrollbar); light-mode only
  details/
    page.tsx            # Server component — 10-day hourly forecast table
    loading.tsx         # Streaming skeleton shown while server fetches data
  score/
    page.tsx            # Server component — fishing score table (0–100%) with per-hour ratings;
                        # source links removed; replaced by a 3-button footer bar
                        # (About Fishing Score + About NoFish + Feedback)
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
                        # Also used as the clickable 🎣 NoFish logo on all detail pages
  Footer.tsx            # Inline button bar on sub-pages — "About NoFish" and "Feedback" links styled like PageNav;
                        # Score page replaces Footer with its own 3-button bar adding "About Fishing Score";
                        # main map page uses the default export HeaderMenu (hamburger dropdown) instead
  ForecastTable.tsx     # Hourly forecast table; columns grouped by API source; ocean columns hidden for inland points
                        # Wind speed and wave height numbers are bold; zero precipitation hidden;
                        # Rain/Snow label derived from first-row air temperature;
                        # uses enrichForecasts() to interpolate wave data and trim at last hourly MET row;
                        # interpolated wave values shown in grey italic
  Map.tsx               # Leaflet map; click → marker + popup with large touch-friendly buttons;
                        # parallel geo+ocean-point fetch; blue dot + dashed line to ocean grid point;
                        # Score/Tide buttons hidden when ocean data unavailable;
                        # crosshair location button below zoom controls → navigates directly to Details
  PageNav.tsx           # Header nav buttons (Score / Details / Tides); current page button is shown as
                        # a non-clickable span with grey background; other pages as blue links;
                        # accepts optional availablePages prop to hide buttons when ocean data is absent

lib/
  api/
    barentswatch.ts     # OAuth2 token management (client-credentials flow) + getWaveForecast() + getSeaCurrentForecast();
                        # in-memory token cache refreshed 60 s before expiry
    weather.ts          # getCombinedForecast() — fetches and merges Locationforecast + Barentswatch waves/current
                        #   + MET Oceanforecast (sea temp) + Kartverket tides;
                        # exports CombinedForecastResult with wave grid coords and tide station metadata;
                        # wave data suppressed when grid point > 1 km from requested location;
                        # tide data also suppressed when wave data is unavailable;
                        # getTidePageData() for the tide page (parallel datatype=all + datatype=tab calls);
                        # getTideForecast() for tide events used in the combined forecast;
                        # solar elevation / sun phase calculation; tide phase labelling;
                        # XML parsed via fast-xml-parser
    geocoding.ts        # reverseGeocode() — Nominatim with rich name fallback chain (village, bay, fjord, sea…);
                        # returns name, municipality, county used consistently across popup and all pages
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    lookups.ts          # insertLookup() + ensureTable() — DDL memoized per process lifetime
    cache.ts            # forecast_cache table — getCached() / setCached() / withInflight()
  utils/
    distance.ts         # haversineDistance(lat1,lng1,lat2,lng2) → km; formatDistance() → "1.2 km" / "350 m"
    timezone.ts         # getTimezone(lat,lng) → IANA name via tz-lookup; getTimezoneLabel() → "Europe/Oslo (GMT+2)"
    enrichForecasts.ts  # enrichForecasts() — trims at last hourly MET row; linearly interpolates Barentswatch
                        # 3-hour wave data to fill every hour; shared by ForecastTable and Score page

public/                 # Static assets (OG image, favicons)
types/
  weather.ts            # TypeScript interfaces for MET Norway API responses, HourlyForecast, TideXMLResponse, etc.
```

---

## Navigation Model

All coordinate state lives in URL search params (`?lat=…&lng=…`). No global state, no context.

### Map popup buttons and PageNav

Both the Leaflet popup and the in-page header share the same navigation targets:

| Button | Background | Route | Condition |
|---|---|---|---|
| Score | Green text / grey bg | `/score?lat=…&lng=…&zoom=…` | Ocean data available (grid point ≤ 1 km) |
| Details | White / ocean-blue | `/details?lat=…&lng=…&zoom=…` | Always shown |
| Tides | White / blue | `/tide?lat=…&lng=…&zoom=…` | Ocean data available (grid point ≤ 1 km) |

The **current page's button is shown as a non-clickable grey span** in `PageNav`. Score and Tides are hidden both in the popup and in `PageNav` when the ocean forecast grid point is more than 1 km away. The `zoom` param is appended by the map popup so the map zoom level can be restored when navigating back.

### My Location

A crosshair-icon button below the Leaflet zoom controls calls `navigator.geolocation.getCurrentPosition()` and navigates directly to `/details?lat=…&lng=…&zoom=…` — bypassing the popup.

### Back navigation

`BackButton` reads `lat`, `lng`, and `zoom` from the current page's search params and navigates to `/?lat=…&lng=…&zoom=…`. On detail pages it is rendered as the `🎣 NoFish` logo text — the entire logo is the back button.

`Map.tsx` reads these params on mount and:
1. Initialises the map at the saved center and zoom
2. After 150 ms (tiles loading), calls `openMarkerAt()` to place the marker and open the popup
3. `openMarkerAt()` also fires the parallel geo+ocean-point fetch, so the blue ocean dot appears as normal

### Location Names

All pages and the map popup use a consistent `"name, municipality, county"` format from `reverseGeocode()`. When name equals municipality, it is not repeated.

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
       │    └─ GET /api/ocean-point?lat=&lon=
       │         └─ lib/api/weather.ts (getCombinedForecast)
       │              ├─ returns only oceanForecastLat/Lng (2-3 JSON fields)
       │              └─ Map draws blue CircleMarker + dashed Polyline to ocean grid point
       └─ Popup shows location name (updates when fetch resolves)
            └─ Dot and line remain until next click or page navigation
```

### Detail/Tide page (Server Component)

```
  Page server render
       ├─ lib/utils/timezone.ts → IANA timezone (pure JS via tz-lookup)
       ├─ lib/api/geocoding.ts   → cache hit / miss → Nominatim
       ├─ lib/api/weather.ts
       │    getCombinedForecast() → cache hit / miss → parallel:
       │         ├─ MET Norway Locationforecast 2.0 (weather, wind, precipitation…)
       │         ├─ Barentswatch Waveforecast      (wave height, direction — OAuth2)
       │         ├─ Barentswatch Sea Current       (current speed, direction — OAuth2)
       │         ├─ MET Norway Oceanforecast 2.0   (sea temperature only)
       │         └─ Kartverket Tide API             (high/low events, XML parsed server-side via fast-xml-parser)
       │    Returns: CombinedForecastResult
       │         ├─ forecasts[]        — merged HourlyForecast array
       │         ├─ forecastLat/Lng    — Locationforecast grid point
       │         ├─ oceanForecastLat/Lng — Barentswatch wave grid point (undefined if inland)
       │         ├─ waveForecastSource — 'barentswatch' when wave data is available
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
| MET Norway Locationforecast | Wind (bold speed + gust), Wind dir ↑, Weather icon, Rain/Snow, Air temp | Always shown |
| Barentswatch Waveforecast | Wave height (bold), Wave dir ↑ | Hidden if no `waveHeight` data |
| Barentswatch Sea Current | Current speed (bold), Current dir ↑ | Hidden if no ocean data |
| MET Sea Temp | Sea temp | Hidden if no ocean data |
| Kartverket | Tide phase | Hidden if no ocean data |
| Calculated | Sun phase | Always shown |

`hasOceanData` is derived client-side: `forecasts.some(f => f.waveHeight !== undefined)`. Inland points and locations where the wave grid point is more than 1 km away get a clean weather-only table.

When ocean data is suppressed, tide data is also suppressed. `PageNav` receives an `availablePages` prop to hide Score and Tides from the header navigation.

The table is trimmed at the last 1-hour interval from MET's Locationforecast (~48 hours). Barentswatch wave data (3-hour intervals) is linearly interpolated to fill every hourly row; interpolated values are shown in grey italic to distinguish them from real observations.

---

## Cache Keys and TTLs

| Data | Key pattern | Precision | TTL |
|---|---|---|---|
| Geocoding | `geo3:{lat.2dp}:{lng.2dp}` | ≈1 km | 30 days |
| Weather + ocean | `weather:{lat.2dp}:{lng.2dp}` | ≈1 km | 1 hour |
| Tides (events) | `tide:{lat.0dp}:{lng.0dp}` | Integer (Kartverket’s own precision) | 6 hours |
| Tides (page data) | `tideall:{lat.0dp}:{lng.0dp}` | Integer | 6 hours |

The `geo3:` prefix replaced earlier `geo2:` and `geo:` prefixes to invalidate stale entries that lacked water-body name fallbacks.

---

## Security

Set in `next.config.ts` via `headers()` — applied as HTTP response headers to all routes:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `img-src` allows OSM tile hosts; `connect-src 'self'` only |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer-when-downgrade` |

JSON-LD (`WebApplication` + `WeatherApplication` schema, genre `Fishing`) is injected via a `<script>` tag in `app/layout.tsx`.

---

## Future Work

- [ ] `error.tsx` boundary pages for `/details` and `/tide`
- [ ] `loading.tsx` streaming state for `/tide`
- [ ] Sitemap and `robots.txt`
