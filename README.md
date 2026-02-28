# 🎣 NoFish

**Because fishing in bad weather is worse than no fishing at all.**

NoFish gives small boat fishers precise wind, wave, and tide forecasts for any point on the Norwegian coast — so you can make a safe call before you leave the dock.

🌐 **[nofish.no](https://nofish.no)**

---

## What it does

- Click anywhere on the map to get a forecast for that spot
- **Details** — 10-day hourly weather and ocean conditions
- **Tides** — high/low tide table with min/max highlighted
- **Score** — combined fishing suitability rating *(coming soon)*

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
[Create a new issue on GitHub here](https://github.com/ChrVage/NoFish/issues/new)
