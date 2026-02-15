# 🎣 NoFish

**NoFish** is a web application that helps you decide **when NOT to go fishing** on the Norwegian coast by analyzing weather, tide, and sunlight conditions.

Most hours have poor fishing conditions due to wind, waves, wrong tide timing, or darkness. NoFish scores every hour from **0% (don't go)** to **100% (great conditions)** to help you find the best fishing windows.

🌐 **Live App:** [no-fish.vercel.app](https://no-fish.vercel.app)

---

## Features

- 🗺️ **Interactive Map** - Click anywhere on the Norwegian coast
- 🌊 **Condition Analysis** - Weather, tides, waves, and sunlight
- ⏰ **Hourly Scoring** - 0-100% fishing suitability rating
- 🎯 **Safety-First** - Biased toward NOT going unless conditions are clearly good

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Map:** Leaflet.js
- **APIs:** MET Weather, Kartverket Tides
- **Deployment:** Vercel

---

## Development

### Prerequisites

Before you start developing, ensure you have the following installed:

#### Required Software
- **Node.js** - Version 20.0.0 or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm** - Version 10+ (comes with Node.js)
  - Verify installation: `npm --version`
  - Alternative: [pnpm](https://pnpm.io/) or [yarn](https://yarnpkg.com/)
- **Git** - For version control
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

#### Recommended Tools
- **Visual Studio Code** - Recommended code editor
  - Install extensions:
    - ESLint
    - Tailwind CSS IntelliSense
    - TypeScript and JavaScript Language Features
    - Prettier (optional)
- **Modern Web Browser** - Chrome, Firefox, Edge, or Safari

#### Environment Setup

**Windows Users:** If you encounter PowerShell script execution errors, run this first:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd NoFish
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Copy environment variables if you need custom API endpoints:
   ```bash
   cp .env.example .env.local
   ```
   
   > **Note:** Environment variables are optional. The app works out of the box with default API URLs.

#### API Access
The app uses these public APIs (no API keys required):
- **MET Norway Weather API** - Free, no authentication
- **Kartverket Tides API** - Free, no authentication

Both APIs are publicly accessible with rate limiting. Please be respectful with request frequency.

---

### Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Build for Production
```bash
npm run build
npm start
```

---

## Project Structure

```
app/          # Next.js App Router pages and layouts
components/   # Reusable React components
lib/          # Business logic and utilities
  api/        # External API integrations
  scoring/    # Fishing condition scoring logic
  utils/      # Helper functions
types/        # TypeScript type definitions
public/       # Static assets
```

---

## Deployment

The app is deployed on [Vercel](https://vercel.com) with automatic deployments from Git.

### Deploy Your Own

1. **Via Vercel Dashboard (Recommended)**
   - Push your code to GitHub/GitLab/Bitbucket
   - Import project at [vercel.com/new](https://vercel.com/new)
   - Vercel auto-detects Next.js and configures everything
   - Automatic deployments on every push

2. **Via Vercel CLI (Optional)**
   ```bash
   # Install Vercel CLI globally
   npm install -g vercel
   
   # Deploy to production
   vercel --prod
   ```

No environment variables are required for deployment.

---

## License

See [LICENSE](LICENSE) file.
