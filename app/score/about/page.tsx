import type { Metadata } from 'next';
import Header from '@/components/Header';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NoFish — Fishing Score Algorithm',
  description: 'How the NoFish fishing score is calculated: safety and fishing factors, weights, best windows, and score colour coding.',
};

export default function ScoreAboutPage() {
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

          <h1 className="text-2xl font-bold text-ocean-900 mb-2">Fishing Score Algorithm</h1>
          <p className="text-sm text-gray-500 mb-6">
            The Score page shows a per-hour fishing suitability rating from <strong>0 %</strong> (most dangerous / unfishable) to <strong>100 %</strong> (perfect conditions). Each row includes the time, three scores (Total, Safety, Fishing), and brief explanations by category.
          </p>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-6">

            <p>
              The algorithm is designed for <strong>deep-water fishing (50–200 m)</strong> on the exposed Norwegian coast, where the continuous Norwegian Coastal Current (NCC) often intersects with and overpowers standard tidal movements. The core philosophy is <strong>&quot;No current, no fish&quot;</strong> — water movement is the primary driver for feeding behaviour in deep-water predators such as Ling, Tusk, Cod, and Saithe.
            </p>

            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-6 mb-2">Algorithm design</h2>
              <p>
                Instead of hard if/else brackets, the algorithm uses <strong>continuous mathematical functions</strong> — Gaussian curves, sigmoids, and smooth interpolation — to produce a fine-grained, linear 0–100 % scale. Ten independent variables are each evaluated as a <strong>0.0–1.0 factor</strong>. The factors are split into two groups — <strong>safety</strong> and <strong>fishing</strong> — then multiplied within each group and combined:
              </p>
              <pre className="bg-gray-50 rounded p-3 text-xs overflow-x-auto"><code>{`safetyScore  = round( windF × waveF × lightF × wavePeriodF × 100 )
fishingScore = round( currentF × tideF × moonF × precipF × tempF × pressureF × 100 )
totalScore   = round( safetyScore × fishingScore / 100 )`}</code></pre>
              <p>
                This multiplicative structure means a single dangerous condition (factor → 0) drives the entire score toward 0 %, while excellent conditions require <em>all</em> factors to be high. The split lets users see whether a low score is due to unsafe weather or poor fishing conditions.
              </p>
            </section>

            {/* Safety Factors */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-3">Safety factors</h2>

              <h3 className="text-base font-bold text-ocean-800 mt-4 mb-2">1. Wind Speed &amp; Current Interaction</h3>
              <p className="text-sm">Wind affects surface drift, which determines whether deep-water gear can maintain bottom contact.</p>
              <p className="text-sm font-bold mt-2">Safety overrides:</p>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                <li>Wind &gt; 15 m/s or gusts &gt; 22 m/s → 0.00 (storm)</li>
                <li>Wind &gt; 12 m/s or gusts &gt; 18 m/s → 0.05–0.25 (strong wind)</li>
              </ul>
              <p className="text-sm font-bold mt-2">Wind–current interaction:</p>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                <li>Wind opposing current (&gt; 120° difference) → positive — slows drift</li>
                <li>Wind aligned with current (&lt; 60°, &gt; 5 m/s) → negative — boat drifts too fast</li>
              </ul>
              <p className="text-sm mt-1">Below safety threshold, factor decreases smoothly from 1.0 (calm) toward 0.25 (12 m/s). Gusts above 10–12 m/s apply an additional multiplier (0.85–0.92).</p>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">2. Wave Height</h3>
              <p className="text-sm">Affects gear handling efficiency and vessel safety.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Wave height</th><th className="pb-1">Factor</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">≤ 0.5 m</td><td className="py-1">1.00</td></tr>
                    <tr><td className="py-1 pr-3">0.5–1.0 m</td><td className="py-1">0.60–1.00</td></tr>
                    <tr><td className="py-1 pr-3">1.0–1.5 m</td><td className="py-1">0.35–0.60</td></tr>
                    <tr><td className="py-1 pr-3">1.5–2.0 m</td><td className="py-1">0.05–0.35 (worse with wind)</td></tr>
                    <tr><td className="py-1 pr-3">&gt; 2.0 m</td><td className="py-1">→ 0.00 (dangerous)</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">3. Light &amp; Time of Day</h3>
              <p className="text-sm">Deep-water fish feed more aggressively in low light. Factor peaks at dawn and dusk.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Condition</th><th className="pb-1 pr-3">Factor</th><th className="pb-1">Note</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">Civil twilight / Dawn / Dusk</td><td className="py-1 pr-3">1.00</td><td className="py-1">Peak feeding</td></tr>
                    <tr><td className="py-1 pr-3">Overcast daylight</td><td className="py-1 pr-3">0.85</td><td className="py-1">Fish active</td></tr>
                    <tr><td className="py-1 pr-3">Full daylight</td><td className="py-1 pr-3">0.80</td><td className="py-1">—</td></tr>
                    <tr><td className="py-1 pr-3">Bright sun + clear sky</td><td className="py-1 pr-3">0.70</td><td className="py-1">Fish deep</td></tr>
                    <tr><td className="py-1 pr-3">Nautical twilight</td><td className="py-1 pr-3">0.08–0.20</td><td className="py-1">Dark — poor visibility</td></tr>
                    <tr><td className="py-1 pr-3 font-bold">Night</td><td className="py-1 pr-3 font-bold">0.00</td><td className="py-1 font-bold">Unsafe</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">4. Wave Period</h3>
              <p className="text-sm">Short steep waves are dangerous for small boats. Penalty scales with wave height — below 1.0 m wave height, period has no effect.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Wave period</th><th className="pb-1">Factor (at full height)</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">≥ 10 s</td><td className="py-1">1.00 (comfortable swell)</td></tr>
                    <tr><td className="py-1 pr-3">7–10 s</td><td className="py-1">0.85–1.00</td></tr>
                    <tr><td className="py-1 pr-3">5–7 s</td><td className="py-1">0.60–0.85 (uncomfortable)</td></tr>
                    <tr><td className="py-1 pr-3">&lt; 5 s</td><td className="py-1">0.30–0.60 (steep chop)</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Fishing Factors */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-3">Fishing factors</h2>

              <h3 className="text-base font-bold text-ocean-800 mt-4 mb-2">5. Ocean Current Speed (Base Score)</h3>
              <p className="text-sm">The primary fishing driver. A Gaussian curve centred at <strong>0.4 m/s</strong> (σ = 0.22).</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Current speed</th><th className="pb-1 pr-3">Factor</th><th className="pb-1">Meaning</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">0.0–0.1 m/s</td><td className="py-1 pr-3">~0.10–0.15</td><td className="py-1">&quot;Dead water&quot; — very low bite rate</td></tr>
                    <tr><td className="py-1 pr-3">0.15–0.24 m/s</td><td className="py-1 pr-3">0.15–0.55</td><td className="py-1">Slow — some activity</td></tr>
                    <tr><td className="py-1 pr-3 font-bold">0.25–0.55 m/s</td><td className="py-1 pr-3 font-bold">0.80–1.00</td><td className="py-1 font-bold">Sweet spot — strong feeding</td></tr>
                    <tr><td className="py-1 pr-3">0.6–0.7 m/s</td><td className="py-1 pr-3">0.55–0.70</td><td className="py-1">Gear drag increasing</td></tr>
                    <tr><td className="py-1 pr-3">0.8–1.0 m/s</td><td className="py-1 pr-3">0.20–0.45</td><td className="py-1">Highly inefficient</td></tr>
                    <tr><td className="py-1 pr-3">&gt; 1.0 m/s</td><td className="py-1 pr-3">→ 0.00</td><td className="py-1">Unfishable</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">When no current data is available, a cautious factor of 0.55 is used — unknown current should not inflate the score.</p>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">6. Tidal Phase</h3>
              <p className="text-sm">Tidal phases dictate biological rhythms at depth and nutrient exchange.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Tide phase</th><th className="pb-1 pr-3">Factor</th><th className="pb-1">Rationale</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3 font-bold">Rising tide</td><td className="py-1 pr-3">1.00</td><td className="py-1">Peak hunting aggression</td></tr>
                    <tr><td className="py-1 pr-3 font-bold">Falling tide</td><td className="py-1 pr-3">0.95</td><td className="py-1">Active water exchange</td></tr>
                    <tr><td className="py-1 pr-3">Turning (±1h from Hi/Lo)</td><td className="py-1 pr-3">0.85</td><td className="py-1">Movement slowing/starting</td></tr>
                    <tr><td className="py-1 pr-3">Approaching (±2h)</td><td className="py-1 pr-3">0.75</td><td className="py-1">Moderate movement</td></tr>
                    <tr><td className="py-1 pr-3">Slack tide (exact Hi/Lo)</td><td className="py-1 pr-3">0.55</td><td className="py-1">Least productive</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-1">When no tide data is available, a neutral 0.75 default is used.</p>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">7. Moon Phase</h3>
              <p className="text-sm">Controls the strength of tidal pull — spring tides reach deeper into the water column.</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Moon phase</th><th className="pb-1 pr-3">Factor</th><th className="pb-1">Effect</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">New Moon / Full Moon</td><td className="py-1 pr-3">0.95–1.00</td><td className="py-1">Strongest tidal pull</td></tr>
                    <tr><td className="py-1 pr-3">Waxing/Waning</td><td className="py-1 pr-3">0.86–0.95</td><td className="py-1">Moderate pull</td></tr>
                    <tr><td className="py-1 pr-3">First/Last Quarter</td><td className="py-1 pr-3">0.82</td><td className="py-1">Weakest movement</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">8. Precipitation</h3>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                <li>Dry or light (≤ 0.5 mm/h) → 1.00</li>
                <li>Moderate (0.5–2 mm/h) → 0.93</li>
                <li>Heavy (&gt; 2 mm/h) → 0.85</li>
              </ul>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">9. Sea Temperature</h3>
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                <li>≥ 3°C → 1.00</li>
                <li>&lt; 3°C → 0.92 (reduced fish activity)</li>
              </ul>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">10. Barometric Pressure</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Pressure</th><th className="pb-1 pr-3">Factor</th><th className="pb-1">Meaning</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">1010–1020 hPa</td><td className="py-1 pr-3">1.00</td><td className="py-1">Ideal — fish active</td></tr>
                    <tr><td className="py-1 pr-3">1000–1010 hPa</td><td className="py-1 pr-3">0.95</td><td className="py-1">Good — approaching low</td></tr>
                    <tr><td className="py-1 pr-3">1020–1030 hPa</td><td className="py-1 pr-3">0.90</td><td className="py-1">Slight penalty — fish sluggish</td></tr>
                    <tr><td className="py-1 pr-3">&lt; 1000 hPa</td><td className="py-1 pr-3">0.88</td><td className="py-1">Storm-adjacent</td></tr>
                    <tr><td className="py-1 pr-3">&gt; 1030 hPa</td><td className="py-1 pr-3">0.82</td><td className="py-1">Strong stable high — inactive</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Best Fishing Windows */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-2">Best fishing windows</h2>
              <p className="text-sm">
                The Score page highlights up to 2 non-overlapping 1–3 hour stretches with the highest average score. Each window is shown as a card with the average score, date/time range, and links to add the event to Google Calendar, Outlook.com, or download an .ics file.
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1 mt-2">
                <li>Hours with any danger-level condition are excluded</li>
                <li>The algorithm picks the longest stretch within 5 points of the best average</li>
                <li>If every hour has a danger condition, &quot;No safe fishing periods&quot; is shown</li>
                <li>Windows are shown regardless of how low the total score is — even 5 % is shown if safe</li>
              </ul>
              <p className="text-sm mt-2">
                In the hourly table, Total score cells within a best window are highlighted with a <strong>blue border</strong>.
              </p>
            </section>

            {/* Score Colour Coding */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-2">Score colour coding</h2>
              <div className="overflow-x-auto">
                <table className="text-xs w-full mt-1">
                  <thead><tr className="text-left border-b"><th className="pb-1 pr-3">Score</th><th className="pb-1 pr-3">Colour</th><th className="pb-1">Meaning</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1 pr-3">70–100 %</td><td className="py-1 pr-3" style={{ color: '#15803d' }}>Green</td><td className="py-1">Excellent</td></tr>
                    <tr><td className="py-1 pr-3">50–69 %</td><td className="py-1 pr-3" style={{ color: '#65a30d' }}>Light green</td><td className="py-1">Good</td></tr>
                    <tr><td className="py-1 pr-3">35–49 %</td><td className="py-1 pr-3" style={{ color: '#d97706' }}>Amber</td><td className="py-1">Fair</td></tr>
                    <tr><td className="py-1 pr-3">20–34 %</td><td className="py-1 pr-3" style={{ color: '#ea580c' }}>Orange</td><td className="py-1">Poor</td></tr>
                    <tr><td className="py-1 pr-3">0–19 %</td><td className="py-1 pr-3" style={{ color: '#dc2626' }}>Red</td><td className="py-1">Dangerous / unfishable</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6">
              <p className="text-sm text-gray-500">
                See <Link href="/data" className="text-ocean-600 underline">Data Column Reference</Link> for source ratings and column descriptions.
              </p>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
