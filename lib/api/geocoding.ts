/**
 * Reverse geocode coordinates and look up elevation / depth.
 * Primary: Kartverket Stedsnavn (place names) + Høydedata (elevation) APIs.
 * Fallback: Nominatim (OpenStreetMap) for municipality / county.
 */
import { getCached, setCached, withInflight } from '@/lib/db/cache';

export interface GeocodingResult {
  name: string;
  municipality: string;
  county: string;
  country: string;
  displayName: string;
  /** Metres above sea level (positive) or depth below sea level (negative). */
  elevation?: number;
  /** Terrain type returned by Kartverket (e.g. "Hav", "Skog", "Innsjø"). */
  terrain?: string;
  /** true when the point is over sea (terrain === "Hav" or elevation < 0 with no land terrain). */
  isSea?: boolean;
  /** Distance in metres from the clicked point to the named place. */
  placeDistanceM?: number;
}

// ── Kartverket Stedsnavn /punkt response types ────────────────────────────

interface KartverketPunktEntry {
  meterFraPunkt: number;
  navneobjekttype: string;
  stedsnavn: { skrivemåte: string; språk: string; navnestatus: string }[];
  stedsnummer: number;
  stedstatus: string;
}

interface KartverketPunktResponse {
  metadata: { totaltAntallTreff: number };
  navn: KartverketPunktEntry[];
}

// ── Geonorge Høydedata response types ─────────────────────────────────────

interface GeonorgeElevationPoint {
  datakilde: string;
  terreng: string;
  x: number;
  y: number;
  z: number;
}

interface GeonorgeElevationResponse {
  punkter: GeonorgeElevationPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Pick the Norwegian name (or first available) from a Kartverket place record. */
function pickName(entry: KartverketPunktEntry): string {
  const norsk = entry.stedsnavn.find(s => s.språk === 'Norsk');
  return (norsk ?? entry.stedsnavn[0])?.skrivemåte ?? 'Unnamed location';
}

/** Fetch elevation/depth from Kartverket. */
async function fetchElevation(lat: number, lng: number): Promise<{ elevation: number; terrain: string } | null> {
  try {
    const url = `https://ws.geonorge.no/hoydedata/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: GeonorgeElevationResponse = await res.json();
    const pt = data.punkter?.[0];
    if (!pt || pt.z === undefined) return null;
    return { elevation: pt.z, terrain: pt.terreng ?? '' };
  } catch {
    return null;
  }
}

/**
 * Place-type priority for SEA locations.
 * The Kartverket /punkt API returns compound types like "Skjær i sjø", "Grunne i sjø".
 * We match against the start of the type string to handle variations.
 * Lower number = higher priority (picked first).
 */
const SEA_PRIORITY_PREFIXES: [string, number][] = [
  ['Grunne',       1],   // Grunne, Grunne i sjø — underwater shallows
  ['Skjær',        1],   // Skjær, Skjær i sjø — skerries
  ['Båe',          2],   // underwater rock
  ['Flu',          2],   // shoal/reef
  ['Rev',          3],   // reef
  ['Banke',        4],   // bank
  ['Lysbøye',      5],   // light buoy — good sea landmark
  ['Sjø',          6],
  ['Fjord',        7],
  ['Sund',         8],
  ['Våg',          9],   // Våg, Våg i sjø — small bay
  ['Vik',         10],
  ['Bukt',        10],
  ['Straum',      11],
  ['Havn',        12],
  ['Holme',       14],
  ['Øy',          16],
  ['Halvøy',      18],
  ['Nes',         20],
];

/**
 * Place-type priority for LAND locations.
 */
const LAND_PRIORITY_PREFIXES: [string, number][] = [
  ['By',           1],
  ['Tettsted',     2],
  ['Bydel',        3],
  ['Grend',        5],
  ['Øy',           6],
  ['Halvøy',       7],
  ['Vik',          8],
  ['Våg',          8],
  ['Bukt',         8],
  ['Nes',          9],
  ['Havn',        10],
  ['Strandplass', 11],
  ['Fjord',       12],
  ['Sund',        13],
  ['Dal',         15],
  ['Fjell',       20],
  ['Ås',          25],
  ['Elv',         25],
  ['Innsjø',      25],
  ['Vatn',        25],
  ['Vann',        25],
  ['Tjern',       25],
];

function placeTypePriority(type: string, isSea: boolean): number {
  const table = isSea ? SEA_PRIORITY_PREFIXES : LAND_PRIORITY_PREFIXES;
  for (const [prefix, prio] of table) {
    if (type.startsWith(prefix)) return prio;
  }
  // At sea: unlisted types (land settlements etc.) get 999 so sea features win
  return isSea ? 999 : 50;
}

/**
 * Fetch place name from Kartverket Stedsnavn /punkt endpoint.
 *
 * Strategy: two-pass search.
 *   1. Small radius (500 m) with many results — finds nearby micro-locations
 *      (skerries, shallows, underwater tops) that are most relevant for fishing.
 *   2. If nothing useful found, expand to 5 000 m for broader context.
 *
 * Results are sorted by place-type priority (sea micro-locations first at sea),
 * then by distance, so the most specific nearby name wins.
 */
async function fetchKartverketPlaceName(
  lat: number,
  lng: number,
  isSea: boolean,
): Promise<{ name: string; distanceM: number } | null> {
  const baseUrl = 'https://api.kartverket.no/stedsnavn/v1/punkt';

  const fetchAndRank = async (radius: number, limit: number): Promise<KartverketPunktEntry[] | null> => {
    try {
      const url = `${baseUrl}?nord=${lat}&ost=${lng}&koordsys=4258&radius=${radius}&treffPerSide=${limit}&utkoordsys=4258`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: KartverketPunktResponse = await res.json();
      if (!data.navn || data.navn.length === 0) return null;

      // Filter out inactive places
      const active = data.navn.filter(e => e.stedstatus === 'aktiv');
      if (active.length === 0) return null;

      // Sort by type priority then distance
      return active.sort((a, b) => {
        const pa = placeTypePriority(a.navneobjekttype, isSea);
        const pb = placeTypePriority(b.navneobjekttype, isSea);
        if (pa !== pb) return pa - pb;
        return a.meterFraPunkt - b.meterFraPunkt;
      });
    } catch {
      return null;
    }
  };

  // Pass 1: tight radius — prefer nearby micro-locations
  const nearbyResults = await fetchAndRank(500, 30);
  if (nearbyResults) {
    const best = nearbyResults[0];
    // Accept if it's a high-priority type OR very close
    if (placeTypePriority(best.navneobjekttype, isSea) <= 20 || best.meterFraPunkt <= 200) {
      return { name: pickName(best), distanceM: best.meterFraPunkt };
    }
  }

  // Pass 2: wider radius
  const wideResults = await fetchAndRank(5000, 50);
  if (wideResults) {
    const best = wideResults[0];
    return { name: pickName(best), distanceM: best.meterFraPunkt };
  }

  return null;
}

/** Fallback: Nominatim reverse geocode. */
async function fetchNominatimName(lat: number, lng: number): Promise<{ name: string; municipality: string; county: string; country: string; displayName: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'User-Agent': 'NoFish/1.0 (fishing conditions app)' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const address = data.address || {};
    return {
      name:
        address.village || address.town || address.city || address.hamlet ||
        address.locality || address.suburb || address.neighbourhood ||
        address.body_of_water || address.bay || address.fjord || address.strait ||
        address.sea || address.ocean || address.waterway || address.island ||
        address.archipelago ||
        (data.display_name ? data.display_name.split(',')[0].trim() : undefined) ||
        'Unnamed location',
      municipality: address.municipality || address.county || 'Unknown municipality',
      county: address.county || address.state || '',
      country: address.country || '',
      displayName: data.display_name || '',
    };
  } catch {
    return null;
  }
}

// ── Main function ─────────────────────────────────────────────────────────

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  // v8 prefix: 4 dp cache key (~11 m precision) for accurate depth at clicked point
  const cacheKey = `geo8:${lat.toFixed(4)}:${lng.toFixed(4)}`;

  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) return cached;

  return withInflight<GeocodingResult | null>(cacheKey, async () => {
    try {
      // Fetch elevation first to determine sea/land before picking place name
      const elev = await fetchElevation(lat, lng);

      const isSea = elev
        ? (elev.terrain === 'Hav' || (elev.elevation < 0 && !['Skog', 'Åpen fastmark', 'Bebygd', 'Innsjø', 'Myr', 'Isbre', 'Fjell'].includes(elev.terrain)))
        : false; // default to land when elevation unavailable

      // Fetch place name (Kartverket) and municipality (Nominatim) in parallel.
      // The /punkt endpoint doesn't return kommune, so Nominatim is always needed.
      const [kartverket, nominatim] = await Promise.all([
        fetchKartverketPlaceName(lat, lng, isSea),
        fetchNominatimName(lat, lng),
      ]);

      const name = kartverket?.name || nominatim?.name || '';
      const municipality = nominatim?.municipality || '';
      const county = nominatim?.county || '';
      const country = nominatim?.country || 'Norway';
      const displayName = nominatim?.displayName || '';
      const placeDistanceM = kartverket?.distanceM;

      const result: GeocodingResult = {
        name: name || 'Unnamed location',
        municipality: municipality || 'Unknown municipality',
        county,
        country,
        displayName,
        elevation: elev?.elevation,
        terrain: elev?.terrain,
        isSea,
        placeDistanceM,
      };

      // Cache for 30 days — places don't move
      await setCached(cacheKey, result, 30 * 24);

      return result;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  });
}
