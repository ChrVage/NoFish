# NoFish — Codebase Learning Plan

A staged reading list. Tick boxes as you go. Each stage builds on the previous one — resist jumping ahead until the current stage's mental model is solid.

---

## Stage 0 — Orientation (read, don't open the editor yet)

- [ ] [README.md](../README.md) — what NoFish is, the user-facing feature set, how to run it locally.
- [ ] [readme-technical.md](../readme-technical.md) — architecture, route table, cache strategy, project structure.
- [ ] [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) — public API surface (`/api/v1/*`).
- [ ] [package.json](../package.json) — dependency list, npm scripts (`dev`, `build`, `lint`, `test`, `prepare`).
- [ ] [.github/workflows/ci.yml](../.github/workflows/ci.yml) — what CI runs on every push.

**Checkpoint:** You should be able to answer: what problem does this app solve, which external APIs feed it, and what gets executed on `git push`.

---

## Stage 1 — Build & runtime configuration

- [ ] [next.config.ts](../next.config.ts) — security headers (CSP, HSTS), next-intl plugin, `NEXT_PUBLIC_BUILD_VERSION`.
- [ ] [middleware.ts](../middleware.ts) — locale routing, matcher.
- [ ] [tsconfig.json](../tsconfig.json), [eslint.config.mjs](../eslint.config.mjs), [vitest.config.ts](../vitest.config.ts).
- [ ] [hooks/pre-commit](../hooks/pre-commit) and [hooks/pre-push](../hooks/pre-push) — installed via the `prepare` script.
- [ ] [lib/version.json](../lib/version.json) — auto-updated commit counter.

**Checkpoint:** You know which security headers ship, how the locale prefix appears in URLs, and what blocks a push.

---

## Stage 2 — Internationalisation

- [ ] [i18n/routing.ts](../i18n/routing.ts) — locale list, default, `localePrefix: 'as-needed'`.
- [ ] [i18n/request.ts](../i18n/request.ts) — server-side message loader.
- [ ] [i18n/navigation.ts](../i18n/navigation.ts) — typed `Link` / `useRouter` / `redirect`.
- [ ] [messages/no.json](../messages/no.json) (default) + skim one other locale, e.g. [messages/en.json](../messages/en.json).
- [ ] [components/LocaleSwitcher.tsx](../components/LocaleSwitcher.tsx).

**Checkpoint:** You can add a new translation key end-to-end (server + client component) without grepping.

---

## Stage 3 — Types and shared utilities

- [ ] [types/weather.ts](../types/weather.ts) — `HourlyForecast` and every API-response interface flow from here.
- [ ] [lib/utils/validation.ts](../lib/utils/validation.ts) — coordinate parsing at API boundary.
- [ ] [lib/utils/params.ts](../lib/utils/params.ts) — typed URL builder used by every sub-page link.
- [ ] [lib/utils/distance.ts](../lib/utils/distance.ts) — haversine + formatter.
- [ ] [lib/utils/timezone.ts](../lib/utils/timezone.ts) — `tz-lookup` wrapper.
- [ ] [lib/utils/formatTime.ts](../lib/utils/formatTime.ts) — locale-aware date/time.
- [ ] [lib/utils/sunPhaseStyle.ts](../lib/utils/sunPhaseStyle.ts) — CSS gradient generator.
- [ ] [lib/utils/rateLimit.ts](../lib/utils/rateLimit.ts) — sliding window + 429 headers (`X-RateLimit-*-Minute`, `*-Day`, `Retry-After`).
- [ ] Tests for the above (`*.test.ts` next to each).

**Checkpoint:** You can run `npm test` and explain what each test file is asserting.

---

## Stage 4 — Database layer

- [ ] [lib/db/index.ts](../lib/db/index.ts) — Neon serverless client.
- [ ] [lib/db/cache.ts](../lib/db/cache.ts) — `getCached` / `setCached` / `withInflight`, `forecast_cache` schema, `ensureTable()` memoisation.
- [ ] [lib/db/lookups.ts](../lib/db/lookups.ts) — usage log inserts.
- [ ] [lib/db/apiKeys.ts](../lib/db/apiKeys.ts) — key registration, daily request counter.

**Checkpoint:** You can name every column in `forecast_cache`, `lookups`, and the api-keys tables and explain what writes to each.

---

## Stage 5 — External API adapters

- [ ] [lib/api/geocoding.ts](../lib/api/geocoding.ts) — "Maritime First v9" strategy. Note the Kartverket-first + Nominatim-fallback flow and the `geo9:{lat.4dp}:{lng.4dp}` cache key.
- [ ] [lib/api/weather.ts](../lib/api/weather.ts) — `getCombinedForecast()` orchestrates MET Norway + Barentswatch + Kartverket; learn the cache keys (`weather:{2dp}`, `tide:{0dp}`, `tideall:{0dp}`).
- [ ] [lib/api/barentswatch.ts](../lib/api/barentswatch.ts) — OAuth2 token cache, wave + sea-current fetches.
- [ ] [lib/api/fiskeridirektoratet.ts](../lib/api/fiskeridirektoratet.ts) — protection-zone queries.
- [ ] [lib/api/apiKeyValidator.ts](../lib/api/apiKeyValidator.ts) — header validation + per-key request accounting.
- [ ] [lib/utils/enrichForecasts.ts](../lib/utils/enrichForecasts.ts) — interpolation of 3-hour wave data onto hourly rows.

**Checkpoint:** You can trace a single `/api/weather` call from request to response, listing every upstream HTTP call it may trigger and every cache layer it touches.

---

## Stage 6 — Scoring engine

- [ ] [lib/utils/tuning.ts](../lib/utils/tuning.ts) — `BOAT_SIZE_OPTIONS`, `FISH_TARGET_GROUPS`, `FISHING_METHOD_OPTIONS`, depth profiles.
- [ ] [lib/scoring/fishingScore.ts](../lib/scoring/fishingScore.ts) — `computeFishingScore`, `findBestWindows`, `findNetFishingWindows`, `recommendFishingMethods`. Read this slowly.
- [ ] [lib/scoring/fishingScore.test.ts](../lib/scoring/fishingScore.test.ts) — the tests are the spec.
- [ ] [app/[locale]/score/about/page.tsx](../app/[locale]/score/about/page.tsx) — user-facing description of the same algorithm; useful sanity check.

**Checkpoint:** Given a synthetic `HourlyForecast` and a `TuningSelection`, you can hand-predict the score within a few points.

---

## Stage 7 — Internal API routes

- [ ] [app/api/geocoding/route.ts](../app/api/geocoding/route.ts) (+ [.test.ts](../app/api/geocoding/route.test.ts)) — 60 req/min/IP.
- [ ] [app/api/weather/route.ts](../app/api/weather/route.ts) — 30 req/min/IP.
- [ ] [app/api/weather-point/route.ts](../app/api/weather-point/route.ts) and [app/api/ocean-point/route.ts](../app/api/ocean-point/route.ts) (+ [.test.ts](../app/api/ocean-point/route.test.ts)).
- [ ] [app/api/search/route.ts](../app/api/search/route.ts).
- [ ] [app/api/statistics/route.ts](../app/api/statistics/route.ts).

**Checkpoint:** You can recite the rate-limit, cache header, and rough behaviour of each internal endpoint without looking.

---

## Stage 8 — Public v1 API

- [ ] [app/api/v1/register/route.ts](../app/api/v1/register/route.ts) — per-IP 10/min, 64-hex key.
- [ ] [app/api/v1/score/route.ts](../app/api/v1/score/route.ts) — header auth, per-key 10/min + 100/day, `s-maxage=1800`.
- [ ] [app/api/v1/tide/route.ts](../app/api/v1/tide/route.ts) — same limits.
- [ ] Re-read [API_DOCUMENTATION.md](../API_DOCUMENTATION.md) and [API_TESTING.md](../API_TESTING.md) now that you know the implementation.

**Checkpoint:** You can manually hit every public endpoint with `curl` and predict each response shape (200, 400, 401, 404, 409, 429).

---

## Stage 9 — App shell (server-rendered)

- [ ] [app/layout.tsx](../app/layout.tsx) — root pass-through.
- [ ] [app/[locale]/layout.tsx](../app/[locale]/layout.tsx) — metadata, JSON-LD, manifest, OG, `NextIntlClientProvider`.
- [ ] [app/[locale]/error.tsx](../app/[locale]/error.tsx) — locale-scoped error boundary.
- [ ] [app/robots.ts](../app/robots.ts), [app/sitemap.ts](../app/sitemap.ts).
- [ ] [app/globals.css](../app/globals.css) — Tailwind base + custom scrollbar; note no dark mode.

**Checkpoint:** You can describe what the browser renders before any sub-page even loads.

---

## Stage 10 — Shared UI components

- [ ] [components/Header.tsx](../components/Header.tsx), [components/Footer.tsx](../components/Footer.tsx), [components/Logo.tsx](../components/Logo.tsx).
- [ ] [components/PageNav.tsx](../components/PageNav.tsx), [components/BackButton.tsx](../components/BackButton.tsx), [components/HashScroller.tsx](../components/HashScroller.tsx).
- [ ] [components/ForecastTable.tsx](../components/ForecastTable.tsx) — the workhorse table reused by Details/Score/Tide.
- [ ] [components/TuningControls.tsx](../components/TuningControls.tsx) — tied to `lib/utils/tuning.ts`.
- [ ] [components/SafetyContacts.tsx](../components/SafetyContacts.tsx).
- [ ] [components/ErrorFallback.tsx](../components/ErrorFallback.tsx).
- [ ] [components/BookingButton.tsx](../components/BookingButton.tsx), [components/BookingBanner.tsx](../components/BookingBanner.tsx).
- [ ] [components/FeedbackButton.tsx](../components/FeedbackButton.tsx), [components/FeedbackBanner.tsx](../components/FeedbackBanner.tsx).

**Checkpoint:** You know which components are server vs client and why.

---

## Stage 11 — The map (longest single file in the repo)

- [ ] [components/Map.tsx](../components/Map.tsx) — dynamic-imported, client-only, owns: Leaflet init, OpenStreetMap + Kartverket sjøkart layers, search box, click popup, "My location" + permissions flow, welcome hint, session-storage flags, sea-chart auto-toggle by zoom.

> Allocate dedicated time for this file. Skim once top-to-bottom, then re-read each `useEffect` and `useRef` block carefully.

**Checkpoint:** You can describe the auto-locate flow and explain the interaction-cancel listeners attached in the capture phase.

---

## Stage 12 — Locale-scoped pages

- [ ] [app/[locale]/page.tsx](../app/[locale]/page.tsx) — home; loads `Map` via `next/dynamic`.
- [ ] [app/[locale]/details/page.tsx](../app/[locale]/details/page.tsx) (+ `loading.tsx`, `error.tsx`).
- [ ] [app/[locale]/score/page.tsx](../app/[locale]/score/page.tsx) + [score/about/page.tsx](../app/[locale]/score/about/page.tsx).
- [ ] [app/[locale]/tide/page.tsx](../app/[locale]/tide/page.tsx).
- [ ] [app/[locale]/statistics/page.tsx](../app/[locale]/statistics/page.tsx) — ISR (1 h), direct SQL aggregations including top-municipalities for 1w / 4w / 13w windows.
- [ ] [app/[locale]/about/page.tsx](../app/[locale]/about/page.tsx), [app/[locale]/data/page.tsx](../app/[locale]/data/page.tsx), [app/[locale]/feedback/page.tsx](../app/[locale]/feedback/page.tsx).

**Checkpoint:** For each page you can list which lib/api function is called server-side and which sub-components stream.

---

## Stage 13 — Cross-cutting concerns

- [ ] Caching strategy: cache key precision per data type, why integer-degree for tides, why 2 dp for weather, why 4 dp for geocoding.
- [ ] Rate limiting: how `checkRateLimit` (IP) and `checkApiKeyRateLimit` (key) share the same module but different tables.
- [ ] Error model: when routes return 400 vs 404 vs 500 vs 502, and what the client error boundaries render.
- [ ] Observability: `console.error` patterns; `after()` usage for non-blocking writes.
- [ ] Performance: streaming with `loading.tsx`, server components vs client islands, ISR revalidation windows.

---

## Stage 14 — Exercises (do at least three)

- [ ] Add a new translation string and surface it on the Score page.
- [ ] Add a new column to the Details forecast table that derives from an existing `HourlyForecast` field.
- [ ] Add a vitest spec for a previously-untested helper in `lib/utils/`.
- [ ] Run the app locally against a `.env.local` and reverse-geocode three coastal coordinates; inspect the `forecast_cache` rows in Neon.
- [ ] Register an API key against the local dev server and hit `/api/v1/score` until you trigger a 429; verify all expected headers.
- [ ] Read [keep/](.) for any work-in-progress notes; cross-reference what is documented vs implemented.

---

## Things to revisit periodically

- [ ] `next` / `next-intl` / `react` upgrade notes in their changelogs — this app sits on modern majors.
- [ ] MET Norway, Barentswatch, and Kartverket API change announcements.
- [ ] Neon's serverless driver release notes — connection-pool semantics shift between versions.
