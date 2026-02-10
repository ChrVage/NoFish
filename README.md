# 🎣 NoFish

**NoFish** is a web application that helps you decide **when NOT to go fishing** on the Norwegian coast.

Most hours have poor conditions due to wind, waves, tide timing, or darkness.  
NoFish analyzes weather, tide, and sun data to present the **next safe and optimal fishing windows** — scored from **0% (don’t go)** to **100% (great conditions)**.

---

## Why this project exists

This project has three goals:

1. Cover real needs with practical functionality
2. Learn modern best-practice tools for web apps and APIs
3. Create a professional public GitHub repository

This is a **real decision support tool**, not a demo app.

---

## The core idea

Select a point on the map → fetch data from APIs → calculate a score for every hour → group hours with similar scores → present clear fishing windows.

### Example output

| Day | Date | Time window        | Score range |
|-----|------|--------------------|-------------|
| Mon | 13   | 14:00–16:00        | 10% – 20%   |
| Mon | 13   | 17:00              | 10% – 30%   |
| Mon | 13   | 18:00–08:00        | 0%          |
| Tue | 14   | 09:00–10:00        | 10% – 40%   |

Most hours will be **0%**. That is intentional.

---

## Safety rules baked into the logic

- Running time from port to fishing spot is **excluded**
- Boats without lights must be back **before end of civil twilight** (not nautical twilight)
- The app is biased toward **not going fishing** unless conditions are clearly acceptable

---

## UX flow

### First page
- Leaflet map
- Shows previously clicked locations
- Click a point on the coast
- Confirm the location with a name

### Data phase 1
- Wind
- Tide times
- Sunrise / sunset / civil twilight

### Data phase n (future)
- Wave height
- Ocean current
- Cloud cover

### Result page
- Grouped hourly time slots
- Fishing suitability score (0–100%)
- Explanation of why the score is what it is

---

## Condition scoring model

Every hour gets a score based on:

| Factor                | Why it matters                                  |
|-----------------------|--------------------------------------------------|
| Wave height           | Boat stability and fishing comfort              |
| Wind speed / gust     | Safety and drift control                       |
| Precipitation         | Comfort and visibility                         |
| Tide timing           | Fish activity                                  |
| Sun / civil twilight  | Safe return                                    |
| Forecast accuracy     | Trustworthiness of prediction                  |

All hours with equal score ranges are grouped together.

---

## Tool stack

| Purpose        | Tool |
|----------------|------|
| Frontend + API | Next.js (Vite) |
| Map            | Leaflet.js |
| Database       | Supabase (scoring model + caching spots) |
| Weather        | MET Locationforecast |
| Waves          | Kystdata / BarentsWatch |
| Tides          | Kartverket |
| Sun            | SunCalc (npm) / Sunrise API |
| DNS / Hosting  | one.com |
| Dev            | VS Code + GitHub Copilot |
| Styling        | Tailwind CSS |
| Linting        | ESLint |

---

## High-level architecture
Map click
↓
Lat/Lon
↓
API routes
├─ MET weather
├─ SunCalc
├─ Kartverket tides
↓
Timeslot + score engine (pure TypeScript)
↓
Grouped time windows
↓
UI presentation


The **timeslot + score engine** is the heart of the app and is written as a pure, testable TypeScript module.

---

## Project principles

- As simple as possible, but not simpler
- UX first, APIs second
- Small vertical slices that always work end-to-end
- Professional repo hygiene from day one
- Code should be understandable by GitHub Copilot

---

## Environment variables

Create `.env.local` from `.env.example`.

Example:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
MET_API_USER_AGENT=your@email.com

---

## Development

```bash
npm install
npm run dev
Lint:
npm run lint

Future ideas
- Personal boat profile (speed, lights, safety margin)
- Historical “did I catch fish?” feedback loop
- Better wave and current modeling
- Shareable fishing spots
- Why most hours are 0%

Because going fishing in bad conditions is worse than not going at all.
