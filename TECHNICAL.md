# NoFish — Technical Documentation

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript |
| Runtime | React 19.2.3 |
| Styling | Tailwind CSS v4 |
| Map | Leaflet.js + react-leaflet with OpenStreetMap tiles |

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
  results/
    page.tsx            # Results page — forecast table for selected location
  api/
    geocoding/
      route.ts          # Server-side proxy → Nominatim reverse geocoding
    weather/
      route.ts          # Server-side proxy → MET Norway weather + ocean forecasts
    tides/
      route.ts          # Placeholder (tide integration pending)

components/
  Map.tsx               # Leaflet map (SSR-disabled, dynamic import)
  ForecastTable.tsx     # Hourly forecast table with direction arrows and weather icons

lib/
  api/
    weather.ts          # Core logic: fetches & merges weather, ocean, and tide data
    geocoding.ts        # Nominatim reverse geocoding helper

types/
  weather.ts            # Weather, ocean, and tide TypeScript types
  fishing.ts            # Fishing-related types
  api.ts                # API response types

public/                 # Static assets
```

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

The live app runs on [Vercel](https://vercel.com) at [no-fish.vercel.app](https://no-fish.vercel.app), with automatic deployments triggered by pushes to the main branch.

No environment variables are required — all APIs are public and unauthenticated.

### Deploy Your Own Fork

**Via Vercel Dashboard (recommended)**

1. Push your fork to GitHub/GitLab/Bitbucket
2. Import at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Next.js and configures everything

**Via Vercel CLI**

```bash
npm install -g vercel
vercel --prod
```

---

## API Notes

All external API calls are made server-side (via Next.js API routes) to avoid CORS issues and to comply with API rate-limiting best practices. A `User-Agent` header identifying the app is included with every request as required by MET Norway.
