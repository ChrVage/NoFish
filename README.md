# 🎣 NoFish

**NoFish** is a web application that tells you when **not** to go fishing on the Norwegian coast — because fishing in bad weather is worse than no fishing at all.

It shows hourly weather, ocean, and tide forecasts for any point on the Norwegian coast so you can plan (or skip) your fishing trips with confidence.

🌐 **Live App:** [no-fish.vercel.app](https://no-fish.vercel.app)

> For setup instructions, tech stack, and deployment details see [TECHNICAL.md](TECHNICAL.md).

---

## Features

- 🗺️ **Interactive Map** — Click anywhere on the Norwegian coast to select a location
- 🌊 **Weather Data** — Air temperature, wind speed/direction, precipitation, cloud cover, and pressure
- 🌊 **Ocean Data** — Wave height/direction, sea temperature, and current speed/direction
- 🌙 **Tide Data** — Semi-diurnal tidal model (simulated; real API has CORS restrictions)
- ⏰ **Hourly Forecast** — 10-day forecast displayed in Norwegian timezone (Europe/Oslo)
- 📍 **Location Info** — Automatic reverse geocoding to show place, municipality, and county

---

## How It Works

1. **Select a location** — Click anywhere on the map
2. **Data is fetched** — Weather, ocean, and tide data for those coordinates is retrieved via server-side API routes
3. **View the forecast** — A detailed hourly table covers the next 10 days
4. **Plan accordingly** — Use the data to decide whether it's worth heading out

### What the forecast includes

| Column | Details |
|---|---|
| Weather | Temperature, wind speed/direction, precipitation, cloud cover, pressure, humidity |
| Ocean | Wave height/direction, sea temperature, current speed/direction |
| Tides | Simulated tide height in cm above chart datum |
| Time | Norwegian timezone — format: `Mon. 15:00` |

---

## Future Enhancements

- **Fishing Condition Scoring** — 0–100% suitability rating based on combined conditions
---
