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
6. WCAG (Accessibility): Proper semantic HTML, correct ARIA roles (crucial for the map and data tables), and full keyboard navigability. 
7. Review readme files on github to make sure they are up to date.
    README.md - contains information on why the project exists, what the solution does and how to use it.
    readme-technical.md should contain more detailed information on the platform, components used and how it all connects.
8. Design
    Everything should look beautiful and consistent.
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
- when my location is chosen, and it's on land. The score and tide buttons show, this is not neccessary.

- When the current is not used for score calculation, it shouldn't give such a high score.

- Could the different timezone calculations be simplified?

- Implement link to seasonal **protection zones** from Fiskeridirectoratet
- Link directly to **fishing rules** by species from Fiskeridirektoratet.

- Find a way to show the VHF working channel, emergency channel (16) and create hyperlink with phone number to Kystradioen (120)

- Explore possibilities for changing boat size and fish species to tune for (fish species will help adapt the depth. But polloch could be large at the bottom and small higher up.) 

- Also support Norwegian language.

- Create a colour palette, then a better icon and logo https://realfavicongenerator.net/

- Create possibility to choose email for those without GitHub account. The email link could use a link with specified subject and body. It should be sent to feedback@nofish.no.

- Explore which license is right for this project.

- SEO to make sure people find the site when I am happy with it.

### To implement later (in case number of users increase)
- Implement function for optional payment

- Implment an **API** so others can collect next best fishing times based on coordinates.

- Functionality for subscribing to calendar appointments with good fishing times.

- Add possibility for fish logging, and add weather to the log,so that you can know in which conditions you fish the fish. Send mail after fishing appointment.

## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?

Run vitest and eslint before answering, prioritize fixes from here.