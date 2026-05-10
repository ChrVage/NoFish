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
9. Documentation on the site should be revieved in English, then all translations should be verified.


## Reason for existing
Found in the [README.md](README.md) file.

## First prio changes


### Second prio changes

- API should support input for other scores than fishing score, such as wind strength and direction, high and low tide values, wave height [and direction]. 

- Create API documentation on nofish.no - link to it from an appropriate page

- Explore how we could collaborate with other enthusiasts, like Fishbuddy. Norway vs global presence.

- Functionality for subscribing to calendar appointments with good fishing times or other score models.

- Add possibility for fish logging, and add weather to the logged fish, so that you can know in which conditions you fish the fish. Send mail after fishing appointment to collect the data via link.

- Implement function for optional payment, like "buy me a coffee" or something like that - to cover the development and hosting costs.
## Instructions for response

Provide a brief summary of the overall code quality in the context of the NoFish architecture, reason to exist and future plans.

Identify and explain the **single most important** change in detail. Why is it critical for performance, security, or UX?

**Run vitest and eslint and fix errors** before answering.

# Prompt for designing a logo

Act as an expert Scandinavian graphic designer specializing in minimalist and modern aesthetics. Your task is to design a simple, stylish, and circular logo for the "NoFish" web application. This application is a marine weather forecasting tool for fishers, providing safety and fishing condition data along the Norwegian coast.

## Design requirements:
1. **Style**: The logo should embody Scandinavian design principles—minimalist, clean, and functional. Use rounded and easy curves to create a friendly and approachable aesthetic.
2. **Shape**: The logo must be circular to symbolize unity and inclusiveness.
3. **Inspiration**: Take inspiration from the "yr.no" logo, focusing on simplicity and clarity.
4. **Colors**: Use the following NoFish brand colors to ensure consistency with the application's design:
   - Maritime Teal: #00796b, #00695c, #004d40
   - Coastal Red: #e53935, #d32f2f, #c62828
5. **Typography**: If text is included, use a modern, sans-serif font that complements the Scandinavian aesthetic.
6. **Versatility**: Ensure the logo is versatile and works well in various sizes and contexts, including app icons, website headers, and print materials.