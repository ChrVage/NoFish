/**
 * Reverse geocode coordinates and look up elevation / depth.
 * Primary: Geonorge Stedsnavn + Høydedata APIs (Kartverket).
 * Fallback: Nominatim (OpenStreetMap) for place name when Geonorge returns nothing.
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

// ── Geonorge Stedsnavn response types ─────────────────────────────────────

interface GeonorgeName {
  meterFraPunkt: number;
  navneobjekttype: string;
  kommuner?: { kommunenavn?: string; fylkesnavn?: string }[];
  stedsnavn: { skrivemåte: string; språk: string; navnestatus: string }[];
}

interface GeonorgeStedResponse {
  navn: GeonorgeName[];
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

/** Pick the Norwegian name (or first available) from a Geonorge place record. */
function pickName(entry: GeonorgeName): string {
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
 * Place-type priority for SEA locations: shallows/reefs first, then sea, then islands.
 * Types NOT listed here get a very high default (999) so land names fall to the bottom.
 */
const SEA_PRIORITY: Record<string, number> = {
  'Grunne':       1,
  'Skjær':        1,
  'Båe':          2,
  'Flu':          2,
  'Rev':          3,
  'Banke':        4,
  'Sjø':          5,
  'Fjord':        6,
  'Sund':         7,
  'Vik':          8,
  'Bukt':         8,
  'Straum':       9,
  'Havn':        10,
  'Holme':       12,
  'Øy':          14,
  'Halvøy':      16,
  'Nes':         18,
};

/**
 * Place-type priority for LAND locations: settlements first.
 */
const LAND_PRIORITY: Record<string, number> = {
  'By':           1,
  'Tettsted':     2,
  'Bydel':        3,
  'Grend':        5,
  'Øy':           6,
  'Halvøy':       7,
  'Vik':          8,
  'Bukt':         8,
  'Nes':          9,
  'Havn':        10,
  'Strandplass': 11,
  'Fjord':       12,
  'Sund':        13,
  'Dal':         15,
  'Fjell':       20,
  'Ås':          25,
  'Elv':         25,
  'Innsjø':      25,
  'Vatn':        25,
};

function placeTypePriority(type: string, isSea: boolean): number {
  const table = isSea ? SEA_PRIORITY : LAND_PRIORITY;
  // At sea: unlisted types (land settlements etc.) get 999 so sea features win
  return table[type] ?? (isSea ? 999 : 50);
}

/** Fetch closest well-known place name from Geonorge Stedsnavn. */
async function fetchGeonorgeName(lat: number, lng: number, isSea: boolean): Promise<{ name: string; municipality: string; county: string; distanceM: number } | null> {
  try {
    const url = `https://ws.geonorge.no/stedsnavn/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258&radius=10000&treffPerSide=30`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: GeonorgeStedResponse = await res.json();
    if (!data.navn || data.navn.length === 0) return null;

    // Sort by place-type priority (sea vs land), then by distance
    const sorted = [...data.navn].sort((a, b) => {
      const pa = placeTypePriority(a.navneobjekttype, isSea);
      const pb = placeTypePriority(b.navneobjekttype, isSea);
      if (pa !== pb) return pa - pb;
      return a.meterFraPunkt - b.meterFraPunkt;
    });

    const entry = sorted[0];
    const kommune = entry.kommuner?.[0];
    return {
      name: pickName(entry),
      municipality: kommune?.kommunenavn ?? '',
      county: kommune?.fylkesnavn ?? '',
      distanceM: entry.meterFraPunkt,
    };
  } catch {
    return null;
  }
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
  // v7 prefix: improved sea priority — land names no longer picked at sea
  const cacheKey = `geo7:${lat.toFixed(2)}:${lng.toFixed(2)}`;

  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) return cached;

  return withInflight<GeocodingResult | null>(cacheKey, async () => {
    try {
      // Fetch elevation first to determine sea/land before picking place name
      const elev = await fetchElevation(lat, lng);

      const isSea = elev
        ? (elev.terrain === 'Hav' || (elev.elevation < 0 && !['Skog', 'Åpen fastmark', 'Bebygd', 'Innsjø', 'Myr', 'Isbre', 'Fjell'].includes(elev.terrain)))
        : false; // default to land when elevation unavailable

      // Now fetch place name with sea/land-aware priority
      const geonorge = await fetchGeonorgeName(lat, lng, isSea);

      let name = geonorge?.name ?? '';
      let municipality = geonorge?.municipality ?? '';
      let county = geonorge?.county ?? '';
      let country = 'Norway';
      let displayName = '';
      let placeDistanceM = geonorge?.distanceM;

      // Always fetch Nominatim for municipality / county if Geonorge didn't provide one,
      // or as a full fallback when Geonorge returned no name at all
      if (!name || !municipality) {
        const nom = await fetchNominatimName(lat, lng);
        if (nom) {
          if (!name) name = nom.name;
          if (!municipality) municipality = nom.municipality;
          if (!county) county = nom.county;
          country = nom.country || country;
          displayName = nom.displayName;
        }
      }

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
