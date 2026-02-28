# 🎣 NoFish

**Because fishing in bad weather is worse than no fishing at all.**

NoFish gives small boat fishers access to data about wind, wave, and tide forecasts for many points on the Norwegian coast — so they can make a safer call before they leave the dock.
This is not powered by AI - every boat user on the Norwegian coast need to use their own real intelligence and judgement before heading out in the North Sea.

🌐 **[nofish.no](https://nofish.no)**

---

## What it does

Click anywhere on the map to place a marker. A popup shows the location name (reverse-geocoded), coordinates, and three navigation buttons:

- **Score** — combined fishing suitability rating *(coming soon)*
- **Details** — 10-day hourly forecast table: weather (MET Norway), ocean conditions (MET Norway), tides (Kartverket), and calculated sun phase. Columns are grouped by data source. The distance from your clicked point to each API's actual forecast grid/station is shown in the header.
- **Tides** — high/low tide event table for the next 10 days, with peak high and lowest low highlighted.

When the weather API responds, a sky-blue dot and dashed line appear on the map showing the ocean forecast grid point relative to your click.

Navigating back to the map restores the previous zoom level, map position, and reopens the popup at the original click point.

---

## Security

- All external API calls are made **server-side** — no credentials exposed to the browser
- **Content Security Policy** (CSP) restricts scripts, styles, images, and connections to trusted sources
- `no-referrer-when-downgrade` referrer policy
- No cookies, no tracking, no third-party scripts
- Lookup logging (production only) stores coordinates and anonymised request metadata in a private Neon database

---

## Docs

- [readme-technical.md](readme-technical.md) — tech stack, APIs, database, and deployment
- [readme-architecture.md](readme-architecture.md) — project structure and data flow
- [readme-dataquality.md](readme-dataquality.md) — data source ratings and limitations

---

## Feedback and issues

Did you find an issue, or do you have a wish for new functionality?
[Create a new issue on GitHub](https://github.com/ChrVage/NoFish/issues/new/choose)
