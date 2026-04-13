import type { Metadata } from 'next';
import Header from '@/components/Header';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'NoFish — Data Column Reference',
  description: 'Every column on the NoFish forecast and tide pages explained, with source ratings and data quality notes.',
};

export default function DataPage() {
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg" style={{ padding: '2rem 1.5rem' }}>

          <h1 className="text-2xl font-bold text-ocean-900 mb-2">Data Column Reference</h1>
          <p className="text-sm text-gray-500 mb-4">
            Descriptions of every column shown on the Details and Tide pages, with notes on how the values relate to real-world conditions.
          </p>

          {/* Important disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-900 font-bold mb-1">⚠ All data shown is forecast only</p>
            <p className="text-sm text-amber-800">
              The values on NoFish are <strong>predictions from numerical weather models</strong>, not real-time observations. Forecasts cannot capture every local effect — fjord funnelling, underwater ridges, sudden squalls, or storm surge. <strong>Local knowledge is essential.</strong> Always cross-check with your own experience, VHF weather broadcasts, and conditions at the dock before heading out. The forecast informs your decision — it does not replace it.
            </p>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700 space-y-8">

            {/* Details Page — Forecast Table */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-2 mb-2">Details Page — Forecast Table</h2>
              <p className="text-sm text-gray-500 mb-3">
                Columns are grouped by API source. Ocean columns (wave, current, sea temp, tide) are only shown for coastal locations where the nearest Barentswatch grid point is within 1 km.
              </p>

              {/* MET Norway Locationforecast */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">MET Norway Locationforecast</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1 pr-3">Unit</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Wind</td><td className="py-1.5 pr-3">m/s</td><td className="py-1.5">Sustained 10-minute mean wind speed (bold) followed by gust speed in parentheses. Gust is the expected strongest 3-second wind speed within the hour.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Wind dir</td><td className="py-1.5 pr-3">arrow</td><td className="py-1.5">Direction the wind blows <strong>from</strong>. The arrow points in the direction the wind is heading.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Weather</td><td className="py-1.5 pr-3">emoji</td><td className="py-1.5">Weather symbol summarising precipitation type, cloud cover, and sky conditions for the next 1-hour period.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Rain / Snow</td><td className="py-1.5 pr-3">mm</td><td className="py-1.5">Expected precipitation in the next hour. Column header switches between &quot;Rain&quot; and &quot;Snow&quot; based on the air temperature. Zero precipitation is hidden.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Temp</td><td className="py-1.5 pr-3">°C</td><td className="py-1.5">Air temperature at 2 m above ground.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Pressure</td><td className="py-1.5 pr-3">hPa</td><td className="py-1.5">Air pressure at sea level. Used in the fishing score — moderate low pressure (1010–1020 hPa) is ideal for fish activity.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://api.met.no/weatherapi/locationforecast/2.0/documentation" target="_blank" rel="noopener noreferrer" className="underline">MET Norway Locationforecast 2.0</a> — ~2.5 km grid (HARMONIE-AROME model). Hourly data for the first ~48 hours; 6-hour intervals beyond that (NoFish trims at the last hourly row).
              </p>

              {/* Barentswatch Waveforecast */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Barentswatch Waveforecast</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1 pr-3">Unit</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Height</td><td className="py-1.5 pr-3">m</td><td className="py-1.5"><strong>Significant wave height (Hs)</strong> — the average height of the highest one-third of waves. Roughly 1 in 10 waves will be ~1.3× Hs, and maximum wave height can reach ~1.9× Hs. Bold values are real data points; <span className="italic text-gray-400">grey italic</span> values are linearly interpolated.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Dir</td><td className="py-1.5 pr-3">arrow</td><td className="py-1.5">Mean direction the waves are travelling <strong>from</strong>. The arrow points in the direction the waves are heading.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Period</td><td className="py-1.5 pr-3">s</td><td className="py-1.5"><strong>Peak wave period</strong> — time between dominant wave crests. Longer periods (≥ 10 s) = comfortable swell; short periods (&lt; 5 s) = steep, dangerous chop. Interpolated like wave height.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://www.barentswatch.no/bolgevarsel/" target="_blank" rel="noopener noreferrer" className="underline">Barentswatch Waveforecast</a> — ~4 km grid. Data arrives at 3-hour intervals; NoFish interpolates linearly to fill every hourly row.
              </p>

              {/* Barentswatch Sea Current */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Barentswatch Sea Current</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1 pr-3">Unit</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Current</td><td className="py-1.5 pr-3">m/s</td><td className="py-1.5">Surface ocean current speed. Above ~0.5 m/s indicates strong current. 0.25–0.55 m/s is considered ideal for deep-water fishing.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Dir</td><td className="py-1.5 pr-3">arrow</td><td className="py-1.5">Direction the current is flowing <strong>towards</strong>. The arrow points where the water is moving.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://developer.barentswatch.no/" target="_blank" rel="noopener noreferrer" className="underline">Barentswatch Sea Current</a> — ~800 m grid; hourly. Accuracy is moderate — currents are highly sensitive to local bathymetry and wind.
              </p>

              {/* MET Sea Temp */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">MET Sea Temp</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1 pr-3">Unit</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Temp</td><td className="py-1.5 pr-3">°C</td><td className="py-1.5">Sea surface temperature from MET Norway&apos;s NorKyst800 ocean model.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://api.met.no/weatherapi/oceanforecast/2.0/documentation" target="_blank" rel="noopener noreferrer" className="underline">MET Norway Oceanforecast 2.0</a> — ~800 m grid (NorKyst800), Norwegian coastal waters.
              </p>

              {/* Kartverket */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Kartverket</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Tide</td><td className="py-1.5">Tidal phase label relative to the nearest high/low event, e.g. &quot;Hi (13:18)&quot; at the peak, &quot;Hi+1&quot; one hour after high tide, &quot;Falling&quot; during ebb, &quot;Lo-2&quot; two hours before low tide.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://api.kartverket.no/sehavniva/" target="_blank" rel="noopener noreferrer" className="underline">Kartverket Tide API</a> — based on the nearest tide gauge station.
              </p>

              {/* Calculated */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Calculated columns</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Sun</td><td className="py-1.5">Sun phase: Daylight, Civil twilight, Nautical twilight, or Night. Transition times shown in parentheses. Time column background colour reflects the sun phase.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Moon</td><td className="py-1.5">Current moon phase with emoji: 🌑 New Moon, 🌒 Waxing Crescent, 🌓 First Quarter, 🌔 Waxing Gibbous, 🌕 Full Moon, 🌖 Waning Gibbous, 🌗 Last Quarter, 🌘 Waning Crescent.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Sun position is calculated from latitude, longitude, and UTC time. Moon phase is an astronomical calculation based on the Julian date.
              </p>

              {/* Confidence */}
              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Confidence indicators</h3>
              <p className="text-sm">The Details page shows a confidence legend above the table:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>High</strong> — first ~24 hours; NWP model skill is strong</li>
                <li><strong>Medium</strong> — hours 24–48; still useful but less precise</li>
                <li><strong>Low</strong> — beyond 48 hours (not shown — table is trimmed at MET&apos;s last 1-hour interval)</li>
              </ul>
              <p className="text-sm mt-1">Interpolated wave values (<span className="italic text-gray-400">grey italic</span>) inherently have lower confidence than real 3-hour data points.</p>
            </section>

            {/* Tide Page */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-2">Tide Page</h2>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-3">Column</th><th className="pb-1 pr-3">Unit</th><th className="pb-1">Description</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-3 font-bold">Time</td><td className="py-1.5 pr-3">date + time</td><td className="py-1.5">Predicted time of the high or low tide event, displayed in the local timezone.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Level</td><td className="py-1.5 pr-3">cm</td><td className="py-1.5">Water level relative to <strong>chart datum (CD)</strong> — the lowest astronomical tide level. Highest high and lowest low in the period are shown in bold.</td></tr>
                    <tr><td className="py-1.5 pr-3 font-bold">Type</td><td className="py-1.5 pr-3">—</td><td className="py-1.5">Either <strong>High</strong> or <strong>Low</strong>.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Source: <a href="https://kartverket.no/til-sjos/se-havniva/" target="_blank" rel="noopener noreferrer" className="underline">Kartverket – Se havnivå</a> — tide gauge station network. Data is interpolated to the requested position; station name and distance shown in the page header.
              </p>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">What affects the tide?</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li><strong>Spring tides</strong> (largest range) occur around new moon and full moon.</li>
                <li><strong>Neap tides</strong> (smallest range) occur around first and last quarter.</li>
                <li><strong>Local geography</strong> strongly amplifies or dampens tidal range. A fjord opening can funnel tidal flow.</li>
              </ul>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Kartverket&apos;s values are <strong>astronomical predictions only</strong>. They do not include storm surge. During strong onshore winds or deep low-pressure systems, actual water levels can be 30–100 cm higher than predicted. Always factor in current weather conditions.
                </p>
              </div>
            </section>

            {/* Data Quality and Sources */}
            <section>
              <h2 className="text-lg font-bold text-ocean-900 mt-8 mb-2">Data Quality and Sources</h2>

              <h3 className="text-base font-bold text-ocean-800 mt-4 mb-2">Source ratings</h3>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead><tr className="text-left border-b border-gray-200"><th className="pb-1 pr-2">Source</th><th className="pb-1 pr-2">Data</th><th className="pb-1 pr-2">Quality</th><th className="pb-1 pr-2">Grid</th><th className="pb-1 pr-2">Next-hour</th><th className="pb-1">Next-week</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 pr-2"><a href="https://api.met.no/weatherapi/locationforecast/2.0/documentation" target="_blank" rel="noopener noreferrer" className="underline">MET Locationforecast</a></td><td className="py-1.5 pr-2">Wind, temp, precipitation, pressure</td><td className="py-1.5 pr-2">⭐⭐⭐⭐⭐</td><td className="py-1.5 pr-2">~2.5 km</td><td className="py-1.5 pr-2">Excellent</td><td className="py-1.5">Good 1–3 days</td></tr>
                    <tr><td className="py-1.5 pr-2"><a href="https://api.met.no/weatherapi/oceanforecast/2.0/documentation" target="_blank" rel="noopener noreferrer" className="underline">MET Oceanforecast</a></td><td className="py-1.5 pr-2">Sea surface temperature</td><td className="py-1.5 pr-2">⭐⭐⭐⭐</td><td className="py-1.5 pr-2">~800 m</td><td className="py-1.5 pr-2">Good</td><td className="py-1.5">1–2 days</td></tr>
                    <tr><td className="py-1.5 pr-2"><a href="https://www.barentswatch.no/bolgevarsel/" target="_blank" rel="noopener noreferrer" className="underline">Barentswatch Waves</a></td><td className="py-1.5 pr-2">Wave height, direction, period</td><td className="py-1.5 pr-2">⭐⭐⭐⭐</td><td className="py-1.5 pr-2">~4 km</td><td className="py-1.5 pr-2">Good</td><td className="py-1.5">1–2 days</td></tr>
                    <tr><td className="py-1.5 pr-2"><a href="https://developer.barentswatch.no/" target="_blank" rel="noopener noreferrer" className="underline">Barentswatch Current</a></td><td className="py-1.5 pr-2">Current speed, direction</td><td className="py-1.5 pr-2">⭐⭐⭐</td><td className="py-1.5 pr-2">~800 m</td><td className="py-1.5 pr-2">Moderate</td><td className="py-1.5">Limited 1–2 days</td></tr>
                    <tr><td className="py-1.5 pr-2"><a href="https://api.kartverket.no/sehavniva/" target="_blank" rel="noopener noreferrer" className="underline">Kartverket Tides</a></td><td className="py-1.5 pr-2">Tide event times &amp; heights</td><td className="py-1.5 pr-2">⭐⭐⭐⭐⭐</td><td className="py-1.5 pr-2">Station network</td><td className="py-1.5 pr-2">Excellent</td><td className="py-1.5">Excellent (deterministic)</td></tr>
                    <tr><td className="py-1.5 pr-2"><a href="https://nominatim.org/" target="_blank" rel="noopener noreferrer" className="underline">Nominatim / OSM</a></td><td className="py-1.5 pr-2">Place name from coordinates</td><td className="py-1.5 pr-2">⭐⭐⭐⭐</td><td className="py-1.5 pr-2">N/A</td><td className="py-1.5 pr-2">N/A</td><td className="py-1.5">N/A</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-bold text-ocean-800 mt-6 mb-2">Key limitations</h3>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold">Ocean data is coastal only.</p>
                  <p className="text-sm text-gray-600">Barentswatch models cover Norwegian coastal waters. Ocean data is suppressed when the nearest grid point is more than 1 km from the clicked location — this catches both inland points and edge-of-model locations.</p>
                </div>
                <div>
                  <p className="text-sm font-bold">Wave data is interpolated.</p>
                  <p className="text-sm text-gray-600">Barentswatch provides wave data at 3-hour intervals. NoFish linearly interpolates to fill every hourly row. Interpolated values are displayed in <span className="italic text-gray-400">grey italic</span>. Between data points the interpolation cannot capture sudden changes.</p>
                </div>
                <div>
                  <p className="text-sm font-bold">Tides are astronomical predictions only.</p>
                  <p className="text-sm text-gray-600">Storm surge is not included. During strong onshore winds or low-pressure systems, actual water levels can differ significantly from the prediction.</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-bold text-amber-900">Current speed is forecast only — not observation.</p>
                  <p className="text-sm text-amber-800">
                    The current speed and direction shown on NoFish come from a numerical ocean model, not from real-time measurements. Ocean currents are extremely sensitive to local bathymetry, wind conditions, and tidal interactions. The forecast gives a useful indication of general current patterns, but <strong>cannot be trusted as precise values for a specific spot</strong>. Always rely on local knowledge and on-the-water observation for current conditions.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-bold">Weather accuracy beyond day 3–4.</p>
                  <p className="text-sm text-gray-600">All NWP models lose skill rapidly beyond 3–4 days. The table is trimmed at ~48 hours to stay within the reliable window.</p>
                </div>
                <div>
                  <p className="text-sm font-bold">Forecast grid points vs. clicked point.</p>
                  <p className="text-sm text-gray-600">Both MET and Barentswatch APIs snap coordinates to their nearest grid point. The Details page shows the distance. If the grid point is more than 1 km away, ocean data is dropped entirely.</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                <p className="text-sm font-bold text-amber-900">Not a substitute for judgment.</p>
                <p className="text-sm text-amber-800">
                  NoFish is not powered by AI and does not make recommendations. Every skipper on the Norwegian coast must use their own experience, <strong>local knowledge</strong>, and real intelligence before heading out. The numbers here inform that decision — they do not replace it.
                </p>
              </div>
            </section>

            <section className="mt-6">
              <p className="text-sm text-gray-500">
                See <Link href="/score/about" className="text-ocean-600 underline">Fishing Score Algorithm</Link> for how these values feed into the fishing score.
              </p>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}
