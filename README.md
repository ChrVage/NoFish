# 🎣 NoFish

**NoFish** is a web application that helps you analyze **fishing conditions** on the Norwegian coast by displaying weather, ocean, and tide data.

The app provides detailed hourly forecasts to help you plan your fishing trips with comprehensive environmental data including wind, waves, water temperature, currents, and tides.

🌐 **Live App:** [no-fish.vercel.app](https://no-fish.vercel.app)

---

## Features

- 🗺️ **Interactive Map** - Click anywhere on the Norwegian coast to select a location
- 🌊 **Weather Data** - Air temperature, wind speed/direction, precipitation, cloud cover, and pressure
- 🌊 **Ocean Data** - Wave height/direction, sea temperature, and current speed/direction
- 🌙 **Tide Data** - Simulated tide heights (sample data due to API CORS restrictions)
- ⏰ **Hourly Forecast** - Detailed 10-day forecast with data displayed in Norwegian timezone
- 📍 **Location Info** - Automatic reverse geocoding to show municipality and county names

---

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Map:** Leaflet.js with OpenStreetMap tiles
- **APIs:** 
  - MET Norway Locationforecast API (weather data)
  - MET Norway Oceanforecast API (ocean data)
  - Kartverket API (reverse geocoding)
  - Simulated tide data (Kartverket Tide API has CORS restrictions)
- **Deployment:** Vercel

---

## How It Works

1. **Select a Location**: Click anywhere on the interactive map (focused on Norwegian coast)
2. **Automatic Data Fetch**: The app fetches weather, ocean, and tide data for the selected coordinates
3. **View Forecast**: See a detailed table with hourly forecasts for the next 10 days
4. **Interpret Data**: Use the comprehensive data to plan your fishing trips

### Forecast Data Includes:
- **Weather**: Temperature, wind speed/direction, precipitation, cloud cover, pressure, humidity
- **Ocean**: Wave height/direction, sea temperature, current speed/direction
- **Tides**: Simulated tide height (in cm above chart datum)
- **Time**: Displayed in Norwegian timezone (Europe/Oslo) as "ddd. HH:MM" (e.g., "Mon. 15:00")

---

## Development

### Prerequisites

Before you start developing, ensure you have the following installed:

#### Required Software
- **Node.js** - Version 20.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm** - Version 10+ (comes with Node.js)
  - Verify installation: `npm --version`
  - Alternative: [pnpm](https://pnpm.io/) or [yarn](https://yarnpkg.com/)
- **Git** - For version control
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

#### Recommended Tools
- **Visual Studio Code** - Recommended code editor
  - Install extensions:
    - ESLint
    - Tailwind CSS IntelliSense
    - TypeScript and JavaScript Language Features
    - Prettier (optional)
- **Modern Web Browser** - Chrome, Firefox, Edge, or Safari

#### Environment Setup

**Windows Users:** If you encounter PowerShell script execution errors, run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd NoFish
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Copy environment variables if you need custom API endpoints:
   ```bash
   cp .env.example .env.local
   ```
   
   > **Note:** Environment variables are optional. The app works out of the box with default API URLs.

#### API Access
The app uses these public APIs (no API keys required):
- **MET Norway Locationforecast API** - Free, no authentication (weather data)
- **MET Norway Oceanforecast API** - Free, no authentication (ocean/marine data)
- **Kartverket Geocoding API** - Free, no authentication (location names)
- **Kartverket Tide API** - Currently using simulated data due to CORS restrictions

**Note on Tide Data:** The Kartverket Tide API cannot be called directly from the browser due to CORS restrictions. The app currently generates realistic simulated tide data using a semi-diurnal tidal model. To use real tide data, you would need to implement a server-side proxy.

All APIs are publicly accessible with rate limiting. Please be respectful with request frequency and include a proper User-Agent header.

---

### Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Build for Production
```bash
npm run build
npm start
```

---

## Project Structure

```
app/          # Next.js App Router pages and layouts
  page.tsx          # Home page with interactive map
  results/          # Results page showing forecast data
  api/              # API routes (placeholders)
components/   # Reusable React components
  Map.tsx           # Leaflet map component
  ForecastTable.tsx # Forecast data table
lib/          # Business logic and utilities
  api/        # External API integrations
    weather.ts      # MET Norway weather and ocean forecasts
    geocoding.ts    # Kartverket reverse geocoding
types/        # TypeScript type definitions
  weather.ts        # Weather, ocean, and tide data types
  fishing.ts        # Fishing-related types
  api.ts            # API response types
public/       # Static assets
```

---

## Deployment

The app is deployed on [Vercel](https://vercel.com) with automatic deployments from Git.

### Deploy Your Own

1. **Via Vercel Dashboard (Recommended)**
   - Push your code to GitHub/GitLab/Bitbucket
   - Import project at [vercel.com/new](https://vercel.com/new)
   - Vercel auto-detects Next.js and configures everything
   - Automatic deployments on every push

2. **Via Vercel CLI (Optional)**
   ```bash
   # Install Vercel CLI globally
   npm install -g vercel
   
   # Deploy to production
   vercel --prod
   ```

No environment variables are required for deployment.

---

## Future Enhancements

Potential features for future development:
- **Fishing Condition Scoring** - 0-100% suitability rating based on combined conditions
- **Real Tide Data** - Server-side proxy for Kartverket Tide API to bypass CORS
- **Sunrise/Sunset Times** - Add daylight information for fishing planning
- **Moon Phase** - Include lunar phase data for fishing predictions
- **Favorite Locations** - Save and manage favorite fishing spots
- **Historical Data** - Compare current conditions with historical patterns
- **Mobile App** - Native mobile application for iOS and Android

---

