# NoFish

**Help to avoid taking your boat out when fishing times are suboptimal**
**... because fishing in bad weather is worse than no fishing at all.**

NoFish gives small boat fishers access to wind, wave, and tide forecasts for any point on the Norwegian coast — so they can make a good decision before they leave the dock.

🌐 **[nofish.no](https://nofish.no)**

---

## What it does

Click anywhere on the map to get an hourly forecast with wind, waves, tides, and a fishing score for that location. Designed for small boat fishers on the exposed Norwegian coast.

- **Score** — combined fishing suitability rating (0–100 %) based on wind, waves, tide, light, and weather
- **Details** — hourly forecast table (~48 hours) with columns grouped by data source
- **Tides** — high/low tide events for the next 10 days

This is not powered by AI. Every skipper needs to use their own judgment, experience, and real intelligence before heading out. NoFish gives you the data — the decision is yours.

---

## Docs

- [readme-technical.md](readme-technical.md) — tech stack, APIs, database, deployment, architecture, and project structure

Website documentation (on nofish.no):
- [About NoFish](https://nofish.no/about) — what the site does and how to use it
- [Data Column Reference](https://nofish.no/data) — every column explained, source ratings, and data quality notes
- [Fishing Score Algorithm](https://nofish.no/score/about) — scoring factors and weights

---

## Development

```bash
git clone https://github.com/ChrVage/NoFish.git
cd NoFish
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
```

See [readme-technical.md](readme-technical.md) for prerequisites, database setup, and deployment.

---

## Feedback and issues

[Create a new issue on GitHub](https://github.com/ChrVage/NoFish/issues/new/choose)
