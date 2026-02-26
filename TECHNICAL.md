# NoFish — Technical Documentation

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript |
| Runtime | React 19.2.3 |
| Styling | Tailwind CSS v4 |
| Map | Leaflet.js (vanilla, via `useEffect`) with OpenStreetMap tiles |
| Database | Neon (serverless Postgres) via `@neondatabase/serverless` |

### External APIs

| API | Purpose | Auth |
|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Weather data | None |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Ocean/marine data | None |
| [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/develop/api/Reverse/) | Reverse geocoding | None |
| Kartverket Tide API | Tide data — currently **not used** (CORS restrictions, see below) | None |

**Note on Tide Data:** The Kartverket Tide API cannot be called directly from a browser due to CORS restrictions. The `/api/tides` route exists as a placeholder. Tide heights are currently generated server-side using a semi-diurnal tidal model (simulated data). To integrate real tide data, implement the server-side proxy in `app/api/tides/route.ts`.

---

## Project Structure

```
app/
  layout.tsx            # Root layout with metadata
  page.tsx              # Home page — interactive map
  globals.css           # Global styles (Tailwind)
  details/
    page.tsx            # Full hourly weather + ocean forecast table
    loading.tsx         # Streaming loading state
    BackButton.tsx      # Client component — back to map
  score/
    page.tsx            # Fishing score (coming soon)
    BackButton.tsx
  tide/
    page.tsx            # High/low tide event table
    BackButton.tsx
  api/
    geocoding/
      route.ts          # Server-side proxy → Nominatim reverse geocoding
    weather/
      route.ts          # Server-side proxy → MET Norway weather + ocean forecasts
    tides/
      route.ts          # Placeholder (tide integration pending)
    log/
      route.ts          # POST — logs each lookup to Neon (IP + User-Agent added server-side)

components/
  Map.tsx               # Leaflet map — click to place marker; popup with Score/Details/Tides buttons
  ForecastTable.tsx     # Hourly forecast table with direction arrows and weather icons
  PageNav.tsx           # Header navigation — icon + label buttons linking to the other two views

lib/
  api/
    weather.ts          # Core logic: fetches & merges weather, ocean, and tide data
    geocoding.ts        # Nominatim reverse geocoding helper
  db/
    index.ts            # Neon SQL client (reads DATABASE_URL)
    lookups.ts          # insertLookup() + ensureTable() helpers

types/
  weather.ts            # Weather, ocean, and tide TypeScript types
  fishing.ts            # Fishing-related types
  api.ts                # API response types

public/                 # Static assets
```

---

## Navigation

The map popup and the page headers share the same three icon-over-label buttons:

| Button | Colour | Destination |
|---|---|---|
| Score | Green icon / grey background | `/score?lat=…&lng=…` |
| Details | White icon / ocean blue background | `/details?lat=…&lng=…` |
| Tides | White moon icon / blue background | `/tide?lat=…&lng=…` |

The button for the current page is hidden on that page's header. Clicking anywhere else on the map while a popup is open closes the previous popup and marker before opening a new one.

---

## Database (Neon)

Every location lookup is logged to a Neon serverless Postgres database. **Logging only runs in production** (`NODE_ENV === 'production'`); it is skipped locally.

### What is stored

| Column | Type | Description |
|---|---|---|
| `id` | serial | Auto-incrementing primary key |
| `lat` | double precision | Clicked latitude |
| `lon` | double precision | Clicked longitude |
| `location_name` | text | Reverse-geocoded place name |
| `municipality` | text | Municipality name |
| `county` | text | County name |
| `ip_address` | text | Client IP (from `x-forwarded-for`) |
| `user_agent` | text | Browser / OS string |
| `geo_country` | text | Country code from Vercel header (`x-vercel-ip-country`) |
| `geo_region` | text | Region from Vercel header (`x-vercel-ip-country-region`) |
| `geo_city` | text | City from Vercel header (`x-vercel-ip-city`) |
| `created_at` | timestamptz | UTC timestamp (auto-set) |

### Setup

1. Create a free project at [neon.com](https://neon.com) (or use the **Neon** integration in the Vercel dashboard — it adds `DATABASE_URL` automatically).

2. Add the connection string to your environment:
   ```bash
   # .env.local (local dev)
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   ```
   On Vercel, add `DATABASE_URL` under **Settings → Environment Variables**.

3. The `ensureTable()` helper in `lib/db/lookups.ts` creates the table automatically on the first production cold start. Alternatively, run the SQL manually in the [Neon SQL editor](https://console.neon.tech).

> **Without `DATABASE_URL`** the app will throw on startup. If you want to run without a database, make `insertLookup` a no-op in `lib/db/lookups.ts`.

---

## Development

### Prerequisites

- **Node.js** 20+ — [nodejs.org](https://nodejs.org/)
- **npm** 10+ (bundled with Node.js)
- **Git** — [git-scm.com](https://git-scm.com/)

**Windows:** If you encounter PowerShell script execution errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Setup

```bash
git clone https://github.com/ChrVage/NoFish.git
cd NoFish
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server uses Next.js's built-in fast refresh.

### Build for Production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Deployment (Vercel)

The live app runs on [Vercel](https://vercel.com) at [nofish.no](https://nofish.no), with automatic deployments triggered by pushes to the main branch.

**Required environment variable:** `DATABASE_URL` (Neon connection string — see [Database setup](#database-neon) above).

### Deploy Your Own Fork

**Via Vercel Dashboard (recommended)**

1. Push your fork to GitHub/GitLab/Bitbucket
2. Import at [vercel.com/new](https://vercel.com/new) — Vercel auto-detects Next.js
3. Go to **Storage → Connect Store → Neon** to create a Neon project and add `DATABASE_URL` automatically
4. Deploy — Vercel redeploys automatically on every push

**Via Vercel CLI**

```bash
npm install -g vercel
vercel env add DATABASE_URL production   # paste your Neon connection string
vercel --prod
```

---

## API Notes

All external API calls are made server-side (via Next.js API routes or direct `lib/` calls from Server Components) to avoid CORS issues and to comply with API rate-limiting best practices. A `User-Agent` header identifying the app is included with every request as required by MET Norway.
