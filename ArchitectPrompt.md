# Prompt for reviewing code

Act as an expert Next.js developer and senior code reviewer. 
Please review the provided code for my web application, "NoFish" — a marine weather forecasting tool for fishers that aggregates data from MET Norway, Barentswatch, and Kartverket.

Please review the code based on the following prioritized criteria:

1. Good architecture and Next.js best practices: Clean code, DRY principles, proper separation of server vs. client components, and efficient state management (especially regarding map interactions and zoom state).
2. API efficiency & Data handling: Efficient fetching and aggregation of multiple external APIs server-side, robust error handling, and clean execution of data interpolation (e.g., transforming 3-hour wave data into 1-hour intervals).
3. Security: Verification that API calls and keys remain strictly server-side, safe handling of client inputs (coordinates), and adherence to the strict security headers (CSP, HSTS, no-sniff) defined in the project.
4. User experience & Responsiveness: Mobile-first considerations, especially ensuring that the large forecast tables and map popups are highly readable and responsive on small screens.
5. WCAG (Accessibility): Proper semantic HTML, correct ARIA roles (crucial for the map and data tables), and full keyboard navigability.

## Reason for existing
Found in the [README.md](README.md) file.

## Future plans 

- When inspecting a location at sea, there should be a warning in the header of the details page that indicates the end of the civil twilight for that location. If there are any dangerous conditions forecasted before that time, the time and the condition should be indicated like in the Score page.

- Explore possibilities to tune fish score to the depth where clicked.
- Find a way to toggle current score on and off based on the quality and existence of reliable current forecast. Inform whether or not the current is accounted for.

- Implement link to seasonal **protection zones** from Fiskeridirectoratet
- Link directly to **fishing rules** by species from Fiskeridirektoratet.

- Implment an **API** so others can collect next best fishing times based on coordinates.

- Remove all the other readme pages, and add them as a part of nofish.no, instead of GitHub.
- Create a feedback form on nofish.no. Create link to it on each score, tide and detail, to add data for that point to the feedback.

- Find a better way to determine if the coordinate is land or sea. Today Geonorge not leaving depth is enough for limiting the response.

- Find a way to show the VHF working channel, emergency channel (16) and phone number to Kystradioen (120)

- Explore possibilities for changing boat size and fish species to tune for

- Create a beter Icon and logo https://realfavicongenerator.net/

- SEO to make sure people find the site when I am happy with it.

### Later
- Add possibility for fish logging, and add weather to the log,so that you can know in which conditions you fish the fish.

## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?


# Commands
' npm run dev
' vercel --prod