# 🎣 NoFish

**Because fishing in bad weather is worse than no fishing at all.**

NoFish gives small boat fishers access to wind, wave, and tide forecasts for any point on the Norwegian coast — so they can make a safer call before they leave the dock.

This is not powered by AI. Every skipper needs to use their own judgment, experience, and real intelligence before heading out on the North Sea. NoFish gives you the data — the decision is yours.

🌐 **[nofish.no](https://nofish.no)**

---

## What it does

Click anywhere on the map to place a marker. A popup shows the location name (reverse-geocoded), coordinates, and navigation buttons:

- **Score** — combined fishing suitability rating (0–100 %) based on wind, waves, tide, light, and weather. See [readme-score.md](readme-score.md) for details.
- **Details** — 10-day hourly forecast table with columns grouped by data source. Wind speed (bold) and wave height (bold) are the primary safety numbers. A confidence legend above the table shows how reliability degrades beyond day 3.
- **Tides** — high/low tide events for the next 10 days, with peak high and lowest low highlighted.

Score and Tides buttons are only shown when the ocean forecast grid point is within 1 km of the clicked location. Inland points show only the Details button.

When the forecast responds, a sky-blue dot and dashed line appear on the map showing the ocean forecast grid point closest to your click.

A **location button** (crosshair icon) sits below the zoom controls. Tapping it uses the browser's geolocation API and navigates directly to the Details page for your current position.

The **🎣 NoFish** logo in the top-left of every page is also a back button — tap it to return to the map at your last position and zoom.

Navigating back restores the previous zoom level, map position, and reopens the popup at the original click point.

---

## Forecast table

Columns are grouped by API source:

| Group | Columns | Notes |
|---|---|---|
| MET Norway Locationforecast | Wind (bold speed), Wind dir ↑, Weather icon, Rain/Snow, Air temp | Rain/Snow label based on air temperature |
| MET Norway Oceanforecast | Wave height (bold), Wave dir ↑, Sea temp, Current speed, Current dir ↑ | Coastal locations only |
| Kartverket | Tide | High/low phase label |
| Calculated | Sun | Sunrise/sunset/civil twilight phase |

Zero precipitation is not shown. Ocean columns are hidden when the ocean forecast grid point is more than 1 km from the clicked location. Tide and score pages are also suppressed in this case.

Row background colour indicates **forecast confidence** (also shown in the legend above the table):

| Colour | Confidence | Locationforecast | Oceanforecast |
|---|---|---|---|
| Green | High | ≤ 3 days | ≤ 2 days |
| Amber | Medium | 3–5 days | — |
| Sky | Fair | — | 2–4 days |
| Orange | Low | > 5 days | > 4 days |

---

## Security

- All external API calls are made **server-side** — no credentials or API keys exposed to the browser
- **Content Security Policy** (CSP) enforced as an HTTP response header via `next.config.ts`
- `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` headers on all responses
- `no-referrer-when-downgrade` referrer policy
- `Strict-Transport-Security` (HSTS) with `max-age=63072000; includeSubDomains` — enforces HTTPS for 2 years
- No cookies, no tracking, no third-party scripts
- Lookup logging (production only) stores coordinates and anonymised request metadata in a private Neon database

---

## Docs

- [readme-score.md](readme-score.md) — fishing score algorithm and factor weights
- [readme-technical.md](readme-technical.md) — tech stack, APIs, database, and deployment
- [readme-architecture.md](readme-architecture.md) — project structure and data flow
- [readme-dataquality.md](readme-dataquality.md) — data source ratings and limitations

---

## Feedback and issues

Did you find an issue, or do you have a wish for new functionality?
[Create a new issue on GitHub](https://github.com/ChrVage/NoFish/issues/new/choose)
