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
```bash
Node.js 20+ and npm
```

### Install Dependencies
```bash
npm install
```

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

Deployed automatically via Vercel:
```bash
vercel --prod
```

---

## License

See [LICENSE](LICENSE) file.
