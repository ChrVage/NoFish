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

---

## External APIs

| API | Purpose | Auth |
|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Weather data | None |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Ocean/marine data | None |
| [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/develop/api/Reverse/) | Reverse geocoding | None |
| Kartverket Tide API | Tide data — **not used** (CORS restrictions) | None |

All external calls are made server-side to avoid CORS issues and comply with MET Norway’s rate-limiting requirements. A `User-Agent` header is sent with every request.

Tide heights are currently generated server-side using a semi-diurnal tidal model (simulated). To integrate real data, implement the proxy in `app/api/tides/route.ts`.

---

## Database (Neon)

Lookups are logged to Neon serverless Postgres **in production only** (`NODE_ENV === 'production'`).

### Schema

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

### Setup

1. Create a project at [neon.com](https://neon.com) or connect via **Vercel → Storage → Neon** (adds `DATABASE_URL` automatically).
2. Add to your environment:
   ```bash
   # .env.local
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   ```
3. `ensureTable()` in `lib/db/lookups.ts` auto-creates the table on first cold start.

> **Without `DATABASE_URL`** the app throws on startup. To run without a DB, make `insertLookup` a no-op.

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

> See [ARCHITECTURE.md](ARCHITECTURE.md) for project structure and data flow.
