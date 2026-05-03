# Prompt for reviewing code

Act as an expert Next.js developer and senior code reviewer. 
Please review the provided code for my web application, "NoFish" — a marine weather forecasting tool for fishers that aggregates data from MET Norway, Barentswatch, and Kartverket.

## This solution exist because:
The purpose is to give small boat fishers access to data from sources with the best quality - about safety and fishing coniditions on the Norwegian coast.
The application should also supply data about the weather on land for simplicity.

## Review rules
Please review the code based on the following prioritized criteria:
1. This solution should have only to-the-point functionality. It should be as simple as possible but **no simpler**.
2. Good architecture and Next.js best practices: Clean code, DRY principles, proper separation of server vs. client components, and efficient state management (especially regarding map interactions and zoom state).
3. API efficiency & Data handling: Efficient fetching and aggregation of multiple external APIs server-side, robust error handling, and clean execution of data interpolation (e.g., transforming 3-hour wave data into 1-hour intervals).
4. Security: Verification that API calls and keys remain strictly server-side, safe handling of client inputs (coordinates), and adherence to the strict security headers (CSP, HSTS, no-sniff) defined in the project.
5. User experience & Responsiveness: Mobile-first considerations, especially ensuring that the large forecast tables and map popups are highly readable and responsive on small screens. Make sure UX is intuitive enough so that users don't need any instructions. Adapt and shorten all instructions available on nofish.no to accomodate users with special interest to details. No cookies if it can be avoided.
Make sure all functionality is updated in the documentation. Also read all documentation and modify what is not synchronized with the code.
6. WCAG (Accessibility): Proper semantic HTML, correct ARIA roles (crucial for the map and data tables), and full keyboard navigability. 
7. Review readme files on github to make sure they are up to date.
    README.md - contains information on why the project exists, what the solution does and how to use it.
    readme-technical.md should contain more detailed information on the platform, components used and how it all connects.
8. Design
    Everything should look beautiful and consistent.

## Reason for existing
Found in the [README.md](README.md) file.

## First prio changes
- Also support Norwegian, German, Dutch and Polish languages.

- SEO to make sure people find the site.

### Second prio changes
- Implement a public API with two endpoints: GET /api/v1/score?lat=&lon= (returns best fishing windows + hourly scores) and GET /api/v1/tide?lat=&lon= (returns high/low tide events). Both accept optional boat=, fish=, and method= params; use defaults if omitted.
Registration, not authentication: Callers must register a contact email once via POST /api/v1/register to receive an API key. The key is required on all requests as X-Api-Key: <key>. Keys are stored in the Neon DB. No login flow — the key is purely for contact and abuse tracing, not access control.
Rate limiting: Apply per-key limits (e.g. 100 req/day, 10 req/min) in addition to the existing per-IP limits. Return 429 with a Retry-After header when exceeded.
Do not implement CORS restrictions — the API is intended for server-to-server use and browser CORS headers would not protect it anyway.
Response format: JSON only. Include a generated_at ISO timestamp and a source_credit field citing MET Norway / Barentswatch / Kartverket.
- API should support input for other scores than fishing score, such as wind strength and direction, high and low tide values, wave height [and direction]. 
- Explore how we could collaborate with other enthusiasts, such as Fishbuddy. Norway vs global presence.
- Functionality for subscribing to calendar appointments with good fishing times or other score models.

- Add possibility for fish logging, and add weather to the logged fish, so that you can know in which conditions you fish the fish. Send mail after fishing appointment to collect the data via link.

- Implement function for optional payment, like "buy me a coffee" or something like that - to cover the development and hosting costs.
## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?

**Run vitest and eslint and fix errors** before answering.