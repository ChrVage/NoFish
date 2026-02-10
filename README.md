# 🎣 NoFish

**NoFish** is a web application that helps you decide **when NOT to go fishing** on the Norwegian coast.

Most hours have poor conditions due to wind, waves, tide timing, or darkness.  
NoFish analyzes weather, tide, and sun data to present the **next safe and more optimal fishing windows** — scored from **0% (don’t go)** to **100% (great conditions)**.

---

## Why this project exists

I like taking my boat out on the coast for fishing, but I don't like waves or wind, and I've noticed that fishing isn't too good unless it's a high tide. 

Too many times, I've spent time taking the boat out when I could have spent the time in a better way. 

This app was created as a **real decision support tool**.

---

## The core idea

Select a point on the map → fetch data from APIs → calculate a score for every hour → group hours with similar scores for clarity → present clear fishing windows.

### Example output

| Day | Date | Time window        | Score range |
|-----|------|--------------------|-------------|
| Mon | 13   | 14:00–16:00        | 10% – 20%   |
| Mon | 13   | 17:00              | 10% – 30%   |
| Mon | 13   | 18:00–08:00        | 0%          |
| Tue | 14   | 09:00–10:00        | 10% – 40%   |

Most hours will be **0%**. That is intentional.

---

## Safety rules should be clear

- Running time from fishing spot to port is **excluded**, use your own judgement
- Boats without lights must be back **before end of civil twilight** (not nautical twilight)
- The app is biased toward **not going fishing** unless conditions are clearly acceptable

---

## UX flow

### First page
- Leaflet map
- Shows previously clicked locations (if cookies are accepted)
- Click on your fishing spot on the coast
- Confirm the location with a name

### Data collection - phase 1
- Wind
- Tide times
- Sunrise / sunset / civil twilight

### Future data collection
- Wave height
- Ocean current
- Cloud cover

### Result page
- Hourly time slots, grouped by:
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
