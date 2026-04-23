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

- Is this true: "No current, no fish"? Some places the current is never stronger than 0,15 m/s. Are those places permanently bad? 
- In documentation it says 1 is used when there is no current. Is this true, or should the documentation be fixed?
- It should be possble to zoom in on documentation pages on NoFish, and the text should adapt, instead of flowing over the edge.

- Add new tuning functionality to NoFish with no login and no cookies by using URL parameters as the primary source of truth and localStorage as fallback so user choices persist until next visit and links remain shareable. Add tuning for boat size and fish target while keeping the architecture simple, URL-driven, mobile-friendly, and backward compatible when parameters are missing. Boat size presets must be in feet ranges and include 20 feet, using 15-19 ft, 20-24 ft, 25-30 ft, and 31-40 ft with 20-24 ft as default. Fish targets must be common food fish on the Norwegian coast and include Cod (Torsk), Saithe/Coalfish (Sei), Haddock (Hyse), Mackerel (Makrell), Pollock (Lyr), Halibut (Kveite), Ling (Lange), Tusk (Brosme), Monkfish (Breiflabb), Wolffish (Steinbit), Redfish (Uer), Plaice (Rødspette), Hake (Lysing), plus General recommendation as default. Species tuning must adapt effective depth preference and support Pollock as multi-depth behavior where smaller fish are higher in the water column and larger fish are deeper. Boat size must affect only safety thresholds such as wind limits, wave-height penalties, and short-period wave sensitivity, while species must affect fishing-depth preference and not core safety logic. Ensure URL-first precedence, localStorage fallback, and URL updates when selections change, and include unit tests for profile mapping, parameter precedence, defaults, and compatibility when no tuning parameters are present.
- implement functionality for scoring for different fishing methods; Trolling, Fishing on the same spot, fishing with net (high scone only when also the morning after is calm), fish pot- on the bottom (then current should be ok during the night and next few days)
- Recommended methods when species is selected.

- Are there any other functionalities in this app that could be tested, like the score is tested?

- Also support Norwegian language.

- Create a colour palette, then a better icon and logo, maybe with https://realfavicongenerator.net/

- Create possibility to choose email for those without GitHub account. The email link could use a link with specified subject and body. It should be sent to feedback@nofish.no.

- Explore which license is right for this project.

- SEO to make sure people find the site.

### To implement later (in case number of users increase)
- Implement function for optional payment

- Implment an **API** so others can collect next best fishing times based on coordinates. One for score and detail and one for tide. Make sure I can contact the caller, so I don't need authentication on this solution. Also implement limiting so that I will not take down my data sources. API optionally can include boat size, species and method. Use default if not provided.

- Functionality for subscribing to calendar appointments with good fishing times.

- Add possibility for fish logging, and add weather to the logged fish, so that you can know in which conditions you fish the fish. Send mail after fishing appointment to collect the data via link.

## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?

Run vitest and eslint before answering, prioritize fixes from here.