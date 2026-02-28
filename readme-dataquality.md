# NoFish — Data Quality

NoFish pulls from four external sources. Here is an honest assessment of each.

| Source | Data | Quality | Grid / Point Density | Next-hour accuracy | Next-week accuracy |
|---|---|---|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Wind, temperature, precipitation, pressure | ⭐⭐⭐⭐⭐ | ~2.5 km (HARMONIE-AROME model for Nordic regions) | Excellent | Degrades noticeably after day 3–4, as with any NWP model |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Wave height/direction/period, sea temperature, surface currents | ⭐⭐⭐⭐ | ~800 m (NorKyst800 model) — Norwegian coastal waters only; no data for inland points | Good | Reliable for 1–2 days; wave forecasts degrade quickly beyond that |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide times and heights | ⭐⭐⭐⭐⭐ | Station-based interpolation — coverage along the Norwegian coast | Excellent | Excellent — astronomical tides are deterministic and accurate weeks ahead. Storm surge is **not** included |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Reverse geocoding (place names only) | ⭐⭐⭐⭐ | N/A | N/A | N/A |

## Key limitations to be aware of

- **Ocean data is coastal only.** Locations more than a few dozen kilometres offshore, or any inland point, will show no wave, current, or sea-temperature data.
- **Tides show astronomical predictions only.** Storm surge and wind-driven water-level changes are not reflected.
- **Weather beyond day 4** should be treated as a rough guide rather than a firm forecast — true for any freely available NWP product.

---

> See [readme-technical.md](readme-technical.md) for API details and [readme-architecture.md](readme-architecture.md) for data flow.
