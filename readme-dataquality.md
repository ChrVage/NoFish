# NoFish — Data Quality

NoFish pulls from four external data sources. This document rates each on quality, spatial resolution, and forecast accuracy at different time horizons.

---

## Source Ratings

| Source | Data provided | Quality | Grid / point density | Next-hour accuracy | Next-week accuracy |
|---|---|---|---|---|---|
| [MET Norway Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation) | Wind speed/direction/gust, temperature, precipitation, cloud cover, pressure | ⭐⭐⭐⭐⭐ | ~2.5 km grid (HARMONIE-AROME NWP model, Nordic domain) | Excellent | Good for 1–3 days; degrades noticeably after day 3–4, as with any NWP model |
| [MET Norway Oceanforecast 2.0](https://api.met.no/weatherapi/oceanforecast/2.0/documentation) | Wave height/direction/period, sea surface temperature, current speed/direction | ⭐⭐⭐⭐ | ~800 m grid (NorKyst800 ocean model) — Norwegian coastal waters only | Good | Reliable for 1–2 days; wave height degrades faster than atmospheric fields |
| [Kartverket Tide API](https://api.kartverket.no/sehavniva/) | High/low tide event times and heights (cm above chart datum) | ⭐⭐⭐⭐⭐ | Tide gauge station network along the Norwegian coast; interpolated to requested position | Excellent | Excellent — astronomical tides are deterministic and accurate weeks to years ahead |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Place name from coordinates (reverse geocoding) | ⭐⭐⭐⭐ | N/A | N/A | N/A |

---

## Forecast Confidence

The Details table colour-codes rows by confidence tier. A legend above the table decodes the colours:

| Colour | Label | Locationforecast | Oceanforecast |
|---|---|---|---|
| Green | High | ≤ 3 days ahead | ≤ 2 days ahead |
| Amber | Medium | 3–5 days ahead | 2–4 days ahead |
| Orange | Low | > 5 days ahead | > 4 days ahead |

Beyond the Low tier the underlying NWP models are essentially providing climatological averages rather than genuine forecasts. Treat those rows as rough planning indicators only.

---

## Key Limitations

**Ocean data is coastal only.**
MET Norway's Oceanforecast model covers Norwegian coastal waters. The app suppresses ocean data when the nearest grid point is more than 1 km from the clicked location — this catches both inland points and locations at the edge of the model domain. When ocean data is suppressed, tide and score pages are also hidden. The forecast table shows only weather columns.

**Tides are astronomical predictions only.**
Kartverket’s tide API returns the predicted astronomical tide — the component driven by the moon and sun. Storm surge (meteorological tide) is not included. During strong onshore winds or low-pressure systems, actual water levels can differ significantly from the prediction. Skippers must account for local conditions themselves.

**Weather accuracy beyond day 3–4.**
All NWP (numerical weather prediction) models lose skill rapidly beyond 3–4 days. The 10-day forecast should be treated as a rough planning guide from day 5 onward regardless of the resolution or quality of the underlying model. NoFish data is one input — local knowledge, VHF weather broadcasts, and personal judgment matter equally.

**Forecast grid points vs. clicked point.**
Both MET APIs snap the requested coordinates to their nearest internal grid point. The Details page shows the distance from your clicked point to the actual ocean forecast grid point used (when within 1 km). On the map, a sky-blue dot and dashed line indicate the ocean grid point location. If the grid point is more than 1 km away, the ocean forecast is considered unrepresentative and is dropped entirely.

**Nominatim coverage at sea.**
OpenStreetMap’s reverse geocoder has variable coverage for open-water locations. The app uses a wide fallback chain (village → town → city → hamlet → bay → fjord → strait → sea → ocean → first segment of display name) before falling back to raw coordinates.

**Not a substitute for judgment.**
NoFish is not powered by AI and does not make recommendations. Every skipper on the Norwegian coast must use their own experience, local knowledge, and real intelligence before heading out on the water. The numbers here inform that decision — they do not replace it.

---

> See [readme-technical.md](readme-technical.md) for API endpoint details.
> See [readme-architecture.md](readme-architecture.md) for how these sources are fetched, merged, and cached.
