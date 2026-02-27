# NoFish — Architecture

> This document covers project structure, navigation, and data flow.

---

## Project Structure

```
app/
  layout.tsx            # Root layout — metadata, CSP, JSON-LD
  page.tsx              # Home page — interactive map
  globals.css           # Global styles (Tailwind)
  details/
    page.tsx            # Full hourly weather + ocean forecast table
    loading.tsx         # Streaming loading state
  score/
    page.tsx            # Fishing score (coming soon)
  tide/
    page.tsx            # High/low tide event table
  api/
    geocoding/
      route.ts          # Thin proxy — delegates to lib/api/geocoding.ts (cached)
    weather/
      route.ts          # Thin proxy — delegates to lib/api/weather.ts (cached)

components/
  BackButton.tsx        # Client component — back to map (shared across all pages)
  Map.tsx               # Leaflet map — click to place marker; popup with Score/Details/Tides buttons
  ForecastTable.tsx     # Hourly forecast table with direction arrows and weather icons; accepts timezone prop
  PageNav.tsx           # Header navigation — icon + label buttons for the other two views

lib/
  api/
    weather.ts          # Fetches and merges weather + ocean data from MET Norway; solar/tide phase logic
    geocoding.ts        # Nominatim reverse geocoding with 30-day cache
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    lookups.ts          # insertLookup() + ensureTable() — DDL memoized, fires once per process
    cache.ts            # forecast_cache table — getCached() / setCached() / withInflight()
  utils/
    timezone.ts         # getTimezone(lat, lng) → IANA name via tz-lookup; getTimezoneLabel() → "Zone (GMT+N)"

types/
  weather.ts            # Weather, ocean, and tide types

public/                 # Static assets (og image, icons)
```

---

## Navigation

The map popup and all page headers share the same three icon-over-label buttons:

| Button | Style | Route |
|---|---|---|
| Score | Green icon / grey background | `/score?lat=…&lng=…` |
| Details | White icon / ocean-blue background | `/details?lat=…&lng=…` |
| Tides | White moon icon / blue background | `/tide?lat=…&lng=…` |

- The current page's button is hidden in the header
- Opening a new map popup automatically closes the previous one and removes its marker

---

## Data Flow

```
Browser click on map
  └─ Map.tsx (client)
       ├─ Reverse geocoding:  GET /api/geocoding?lat=…&lon=…
       │    └─ lib/api/geocoding.ts → cache hit? return / miss → Nominatim → cache
       └─ User navigates to /details | /score | /tide

  Page (Server Component)
       ├─ lib/utils/timezone.ts (getTimezone)
       │    └─ tz-lookup → IANA timezone for the clicked coordinates (pure JS, no file I/O)
       ├─ lib/api/geocoding.ts
       │    └─ cache hit?  → return cached result (TTL: 30 days)
       │    └─ cache miss → withInflight → Nominatim → write to cache → return
       ├─ lib/api/weather.ts (getCombinedForecast)
       │    └─ cache hit?  → return cached result (TTL: 1 hour)
       │    └─ cache miss → withInflight → MET Norway (weather + ocean) → write to cache → return
       ├─ lib/api/weather.ts (getTideForecast)
       │    └─ cache hit?  → return cached result (TTL: 6 hours)
       │    └─ cache miss → withInflight → Kartverket → write to cache → return
       └─ after(): lib/db/lookups.ts → Neon (production only)
```

All outbound requests are made server-side. The browser only ever talks to `/api/*` routes on the same origin.

`withInflight` in `lib/db/cache.ts` deduplicates concurrent cold-cache requests for the same key — only one external fetch fires even if multiple requests arrive simultaneously.

### Cache table

`forecast_cache` is stored in the same Neon database as `lookups`. It is created automatically on first write.

| Column | Description |
|---|---|
| `cache_key` | Text primary key — e.g. `geo:59.91:10.75`, `weather:59.91:10.75`, `tide:60:11` |
| `data` | JSONB — the full API response |
| `cached_at` | When the row was last written |
| `expires_at` | Row is ignored (and overwritten) after this timestamp |

Cache key precision:
- **Geocoding** — 2 decimal places (≈1 km), TTL 30 days
- **Weather/ocean** — 2 decimal places (≈1 km), TTL 1 hour
- **Tides** — integer (matches Kartverket's own precision), TTL 6 hours

---

## Security Headers

Set in `app/layout.tsx`:

| Mechanism | Value |
|---|---|
| Content-Security-Policy | Restricts scripts, styles, images, and connections to trusted sources |
| Referrer-Policy | `no-referrer-when-downgrade` |
| JSON-LD schema | `WebApplication`, `WeatherApplication`, genre `Fishing` |

> CSP is applied as a `<meta>` tag (client-enforced). For header-level enforcement, configure `next.config.ts` with `headers()`.

---

## Future Work

- [ ] Fishing Score algorithm (weather + tide + seasonal weighting)
- [ ] CSP moved to HTTP response headers (`next.config.ts`)
- [ ] Sitemap and `robots.txt`
- [ ] `error.tsx` boundary pages for `/details` and `/tide`
- [ ] `loading.tsx` streaming states for `/score` and `/tide`
- [ ] Coordinate bounds validation (reject obviously invalid lat/lng early)
