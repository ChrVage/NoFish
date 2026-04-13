import type { Metadata } from 'next';
import Header from '@/components/Header';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About NoFish — Fishing Forecast for Small Boats',
  description: 'What NoFish does, how to use it, and why it exists. Wind, wave, and tide forecasts for any point on the Norwegian coast.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-ocean-50">
      <Header>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-ocean-800 hover:text-ocean-600 no-underline">
            <span className="text-lg">🎣</span>
            <span className="font-bold">NoFish</span>
          </Link>
        </div>
      </Header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>

          <h1 className="text-2xl font-bold text-ocean-900 mb-2">About NoFish</h1>
          <p className="text-sm text-gray-500 mb-6 italic">
            ... because fishing in bad weather is worse than no fishing at all.
          </p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6">

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">What it does</h2>
              <p>
                NoFish gives small boat fishers access to wind, wave, and tide forecasts for <strong>any point on the Norwegian coast</strong> — so they can make a good decision before they leave the dock.
              </p>
              <p>
                Click anywhere on the map to place a marker. A popup shows the location name, coordinates, and navigation buttons:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Score</strong> — combined fishing suitability rating (0–100 %) based on wind, waves, tide, light, and weather.
                  See <Link href="/score/about" className="text-ocean-600 underline">About Fishing Score</Link> for how it works.</li>
                <li><strong>Details</strong> — hourly forecast table (up to ~48 hours) with columns grouped by data source.
                  Wind speed and wave height are the primary safety numbers.</li>
                <li><strong>Tides</strong> — high/low tide events for the next 10 days, with peak high and lowest low highlighted.</li>
              </ul>
              <p>
                Score and Tides buttons are only shown when the ocean forecast grid point is within 1 km of the clicked location. Inland points show only the Details button.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">How to use it</h2>
              <p>
                When the forecast responds, a sky-blue dot and dashed line appear on the map showing the wave forecast grid point (Barentswatch) closest to your click.
              </p>
              <p>
                A <strong>location button</strong> (crosshair icon) sits below the zoom controls. Tapping it uses the browser&apos;s geolocation API and navigates directly to the Details page for your current position.
              </p>
              <p>
                The <strong>🎣 NoFish</strong> logo in the top-left of every page is also a back button — tap it to return to the map at your last position and zoom.
              </p>
              <p>
                Every sub-page has a footer bar with <strong>About NoFish</strong>, <strong>Data Reference</strong>, and <strong>Feedback</strong> buttons. The Score page adds an <strong>About Fishing Score</strong> button.
              </p>
              <p>
                Navigating back restores the previous zoom level, map position, and reopens the popup at the original click point.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">Forecast table</h2>
              <p>
                The Details page shows an hourly forecast table with columns grouped by API source. See the{' '}
                <Link href="/data" className="text-ocean-600 underline">Data Column Reference</Link> for a full description of every column.
              </p>
              <table className="text-xs mt-2 w-full">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="pb-1 pr-4">Group</th>
                    <th className="pb-1 pr-4">Columns</th>
                    <th className="pb-1">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1 pr-4">MET Norway</td><td className="py-1 pr-4">Wind, Wind dir, Weather, Rain/Snow, Temp</td><td className="py-1">Always shown</td></tr>
                  <tr><td className="py-1 pr-4">Barentswatch Waves</td><td className="py-1 pr-4">Wave height, Wave dir</td><td className="py-1">Coastal only; interpolated hourly</td></tr>
                  <tr><td className="py-1 pr-4">Barentswatch Current</td><td className="py-1 pr-4">Current speed, Current dir</td><td className="py-1">Coastal only</td></tr>
                  <tr><td className="py-1 pr-4">MET Sea Temp</td><td className="py-1 pr-4">Sea temp</td><td className="py-1">From MET Oceanforecast</td></tr>
                  <tr><td className="py-1 pr-4">Kartverket</td><td className="py-1 pr-4">Tide</td><td className="py-1">High/low phase label</td></tr>
                  <tr><td className="py-1 pr-4">Calculated</td><td className="py-1 pr-4">Sun</td><td className="py-1">Sunrise/sunset/twilight</td></tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">Not a substitute for judgment</h2>
              <p>
                This is <strong>not</strong> powered by AI. NoFish does not make recommendations. Every skipper on the Norwegian coast must use their own experience, <strong>local knowledge</strong>, and real intelligence before heading out on the water. The numbers here inform that decision — they do not replace it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">Security &amp; privacy</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>All external API calls are made <strong>server-side</strong> — no credentials exposed to the browser</li>
                <li>No cookies, no tracking, no third-party scripts</li>
                <li>Content Security Policy, HSTS, and X-Frame-Options enforced on all responses</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">More information</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><Link href="/data" className="text-ocean-600 underline">Data Column Reference</Link> — every column explained, source ratings, and data quality</li>
                <li><Link href="/score/about" className="text-ocean-600 underline">Fishing Score Algorithm</Link> — how the 0–100 % score is calculated</li>
                <li><a href="https://github.com/ChrVage/NoFish" target="_blank" rel="noopener noreferrer" className="text-ocean-600 underline">Source code on GitHub</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">Feedback</h2>
              <p>
                Found an issue or have a wish for new functionality?{' '}
                <a href="https://github.com/ChrVage/NoFish/issues/new/choose" target="_blank" rel="noopener noreferrer" className="text-ocean-600 underline">
                  Create a new issue on GitHub
                </a>.
              </p>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
