# Prompt for reviewing code

Act as an expert Next.js developer and senior code reviewer. 
Please review the provided code for my web application, "NoFish" — a marine weather forecasting tool for fishers that aggregates data from MET Norway, Barentswatch, and Kartverket.

## This solution exist because:
The purpose is to give small boat fishers access to data about safety and fishing coniditions in Norway.
The fishermen should also be able to use this on land.

## Review rules
Please review the code based on the following prioritized criteria:
1. This solution should have only to-the-point functionality. It should be as simple as possible but **no simpler**.
2. Good architecture and Next.js best practices: Clean code, DRY principles, proper separation of server vs. client components, and efficient state management (especially regarding map interactions and zoom state).
3. API efficiency & Data handling: Efficient fetching and aggregation of multiple external APIs server-side, robust error handling, and clean execution of data interpolation (e.g., transforming 3-hour wave data into 1-hour intervals).
4. Security: Verification that API calls and keys remain strictly server-side, safe handling of client inputs (coordinates), and adherence to the strict security headers (CSP, HSTS, no-sniff) defined in the project.
5. User experience & Responsiveness: Mobile-first considerations, especially ensuring that the large forecast tables and map popups are highly readable and responsive on small screens. Make sure UX is intuitive enough so that users don't need any instructions. Adapt and shorten all instructions to accomodate users with special interest to details. No cookies if it can be avoided.
6. WCAG (Accessibility): Proper semantic HTML, correct ARIA roles (crucial for the map and data tables), and full keyboard navigability. 
7. Design. 
    Buttons and icons
        Background light grey / gray-100 / #f3f4f6
        Foreground dark gray / gray-800 /  #1f2937
    Selected/pressed button
        Background grey / gray-400 / #9ca3af
        Foreground white / #ffffff
    Text and borders: dark gray / gray-800 /  #1f2937


## Reason for existing
Found in the [README.md](README.md) file.

## To implement before release 
- Implment use statistics. Show them on nofish.no/statistics. Maybe it is possible to use functionality from Vercel?

- Remove the non-technical readme, such as readme-data and readme-score pages, and add them as a page on nofish.no, instead of locked in GitHub. Update the links on the pages to reflect the new pages. Split the Readme.md into a part that stays on Github, with a very short "reason to exist", and links to readme-technical (that also includes readme-architecture). The other part of the Readme.md should be moved to a page on Nofish that explains the webpage and it's purpose. In the readme-data page now moved to nofish.no it should be clearly stated that current is forecast only, and cannot neccessarily be trusted. Local knowledge is important.

- Create a feedback form on nofish.no. Create a suitable icon with link to it on the end of each line with score, tide and detail. Clicing the line adds data for that point to the feedback. Each feedback should be added as an issue on github with a feedback template.

- Use UV warning in the locationforecast. If the level is above 1, add it to the safety info, but it shouldn't affect safety score. If the level is 3 or higher, remind the user to wear sunscreen.

- Find a better way to determine if the coordinate is land or sea.
- Improve location logic, differentiate between land and sea.

- Implement link to seasonal **protection zones** from Fiskeridirectoratet
- Link directly to **fishing rules** by species from Fiskeridirektoratet.

- Find a way to show the VHF working channel, emergency channel (16) and create hyperlink with phone number to Kystradioen (120)

- Explore possibilities for changing boat size and fish species to tune for (fish species will help adapt the depth. But polloch could be large at the bottom and small higher up.) 

- Also support Norwegian language.

- Create a colour palette, then a better icon and logo https://realfavicongenerator.net/

- SEO to make sure people find the site when I am happy with it.

### To implement later (in case number of users increase)
- Implement function for optional payment

- Implment an **API** so others can collect next best fishing times based on coordinates.

- Functionality for subscribing to calendar appointments with good fishing times.

- Add possibility for fish logging, and add weather to the log,so that you can know in which conditions you fish the fish. Send mail after fishing appointment.

## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?

Run vitest and eslint before answering.