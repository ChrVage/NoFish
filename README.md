# 🎣 NoFish

**NoFish** is a web application that tells you when **not** to go fishing on the Norwegian coast — because fishing in bad weather is worse than no fishing at all.

It shows hourly weather, ocean, and tide forecasts for any point on the Norwegian coast so you can plan (or skip) your fishing trips with confidence.

🌐 **Live App:** [nofish.no](https://nofish.no)

> For setup instructions, tech stack, and deployment details see [TECHNICAL.md](TECHNICAL.md).

---

## Features

- 🗺️ **Interactive Map** — Click anywhere on the Norwegian coast to select a location; a popup shows the place name and three navigation buttons
- 📊 **Details** — Full hourly forecast table for the next 10 days: air temperature, wind, precipitation, cloud cover, pressure, wave height/direction, sea temperature, and current
- 🌙 **Tides** — Semi-diurnal tide table with high/low events, highlighting the highest high and the lowest low tide across the period
- 🏆 **Score** *(coming soon)* — A combined fishing suitability score based on tides, weather, and seasonal conditions
- ⏰ **Norwegian Timezone** — All times displayed in Europe/Oslo
- 📍 **Reverse Geocoding** — Automatic place, municipality, and county lookup for any clicked point

---

## How It Works

1. **Select a location** — Click anywhere on the map; a popup appears with the place name and buttons for Score, Details, and Tides
2. **Navigate to a view** — Each view fetches the relevant data server-side for the chosen coordinates
3. **Switch views** — The header on every page has icon buttons to jump between Details, Score, and Tides for the same location
4. **Plan accordingly** — Use the data to decide whether it's worth heading out

### What the forecast includes

| View | Content |
|---|---|
| Details | Hourly: temperature, wind speed/direction, precipitation, cloud cover, pressure, humidity, wave height/direction, sea temp, current speed/direction |
| Tides | High/low tide events with time and height (cm), highest high and lowest low highlighted |
| Score | Combined fishing suitability rating *(coming soon)* |

---

## Future Enhancements

- **Fishing Condition Scoring** — Suitability rating based on combined conditions
- **Real Tide Data** — Server-side proxy to Kartverket Tide API *(CORS prevents direct browser calls)*

---
