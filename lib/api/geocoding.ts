/**
 * Reverse geocode coordinates and look up elevation / depth.
 *
 * "Maritime First" strategy:
 *   1. Høydedata API → terrain + elevation → sea/land classification.
 *   2. Stadnamn /punkt → nearby place names. Maritime features (skjær, grunne,
 *      båe, …) are prioritised when the point is at sea. Coastline edge case:
 *      if technically on land but a maritime feature exists within 50 m, the
 *      maritime name wins.
 *   3. Stadnamn /sted?stedsnummer=X → official kommune + fylke for the winning
 *      place, eliminating the Nominatim dependency for Norwegian locations.
 *   4. Nominatim fallback only when Kartverket cannot supply municipality (e.g.
 *      when the point is outside Norway or the /sted lookup fails).
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
  /** true when the point is classified as sea (based on terrain, elevation, and nearby features). */
  isSea?: boolean;
  /** Distance in metres from the clicked point to the named place. */
  placeDistanceM?: number;
  /** Kartverket navneobjekttype of the chosen place (e.g. "Skjær i sjø"). */
  objectType?: string;
  /** Official four-digit kommune number from SSR (e.g. "5001"). */
  kommuneNr?: string;
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

// ── Kartverket Stedsnavn /sted response types (kommune/fylke lookup) ──────

interface KartverketKommune {
  kommunenavn: string;
  kommunenummer: string;
}

interface KartverketFylke {
  fylkesnavn: string;
  fylkesnummer: string;
}

interface KartverketStedEntry {
  kommuner?: KartverketKommune[];
  fylker?: KartverketFylke[];
  navneobjekttype: string;
  stedsnummer: number;
  stedstatus: string;
}

interface KartverketStedResponse {
  metadata: { totaltAntallTreff: number };
  navn: KartverketStedEntry[];
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

// ── Maritime type classification ──────────────────────────────────────────

/**
 * Prefixes that identify a definitively maritime / underwater place type.
 * Used for the coastline edge case: if any of these appear within 50 m of a
 * technically-on-land point, the maritime name wins.
 */
const MARITIME_PREFIXES: string[] = [
  // Underwater features — most relevant for fishing
  'Grunne',       // Grunne, Grunne i sjø — underwater shallows
  'Skjær',        // Skjær, Skjær i sjø — skerries
  'Båe',          // Båe, Båe i sjø — underwater rock
  'Flu',          // shoal/reef
  'Rev',          // Rev i sjø — reef
  'Korallrev',    // coral reef
  'Klakk',        // Klakk i sjø — small underwater knoll
  'Banke',        // Banke, Banke i sjø — bank
  'Fiskeplass',   // Fiskeplass i sjø — named fishing spot
  // Submarine topography
  'Havdyp',       // deep sea
  'Undersøisk',   // submarine wall
  'Rygg i sjø',   'Renne',        'Egg i sjø',
  'Hylle i sjø',  'Bakke i sjø',  'Bakketopp i sjø',
  'Fjelltopp i sjø', 'Fjellkjede i sjø', 'Sadel i sjø',
  'Morenerygg i sjø', 'Vulkan i sjø', 'Platå i sjø',
  'Sokkel i sjø', 'Basseng i sjø', 'Søkk i sjø', 'Ras i sjø',
  // Sea areas & navigation
  'Sjøstykke',    'Sjødetalj',    'Havområde', 'Havstrøm',
  'Farled',       'Lysbøye',      'Sjømerke',  'Sjøvarde',
  'Kontinentalsokkel', 'Soneinndeling',
];

/** True if the navneobjekttype is a definitively maritime / underwater feature. */
function isMaritimeType(type: string): boolean {
  return MARITIME_PREFIXES.some(p => type.startsWith(p));
}

// ── Priority tables ───────────────────────────────────────────────────────

/** Pick the Norwegian name (or first available) from a Kartverket place record. */
function pickName(entry: KartverketPunktEntry): string {
  const norsk = entry.stedsnavn.find(s => s.språk === 'Norsk');
  return (norsk ?? entry.stedsnavn[0])?.skrivemåte ?? 'Unnamed location';
}

/**
 * Place-type priority for SEA locations.
 * Lower number = higher priority (picked first).
 * The Kartverket /punkt API returns compound types like "Skjær i sjø",
 * "Grunne i sjø". We match against the start of the type string.
 */
const SEA_PRIORITY_PREFIXES: [string, number][] = [
  // Underwater micro-features — prime fishing spots
  ['Fiskeplass',   1],   // Named fishing spots
  ['Grunne',       1],   // Grunne, Grunne i sjø — shallows
  ['Skjær',        1],   // Skjær, Skjær i sjø — skerries
  ['Båe',          2],   // Båe, Båe i sjø — underwater rock
  ['Flu',          2],   // shoal/reef
  ['Korallrev',    2],   // coral reef
  ['Klakk',        2],   // Klakk i sjø — small knoll
  ['Rev',          3],   // Rev i sjø — reef
  ['Banke',        4],   // Banke, Banke i sjø — bank
  // Navigation aids — good sea landmarks
  ['Lysbøye',      5],   // light buoy
  ['Sjømerke',     5],   // sea mark
  ['Sjøvarde',     5],   // sea cairn
  // Submarine topography
  ['Havdyp',       6],   // deep sea area
  ['Undersøisk',   6],   // submarine wall
  ['Rygg i sjø',   6],   ['Bakketopp i sjø', 6],
  ['Fjelltopp i sjø', 6], ['Fjellkjede i sjø', 6],
  ['Morenerygg',   7],   ['Renne',      7],
  ['Egg i sjø',    7],   ['Hylle i sjø', 7],
  ['Bakke i sjø',  7],   ['Sadel i sjø', 7],
  ['Platå i sjø',  7],   ['Sokkel i sjø', 7],
  ['Basseng i sjø', 7],  ['Søkk i sjø', 7],
  ['Ras i sjø',    7],   ['Vulkan i sjø', 7],
  // Sea areas
  ['Sjøstykke',    8],   ['Sjødetalj', 8],
  ['Havområde',    8],   ['Havstrøm', 8],
  ['Farled',       8],
  // Coastal waters
  ['Fjord',        9],   ['Fjordmunning', 9],
  ['Sund',        10],
  ['Våg',         11],
  ['Vik',         12],
  ['Bukt',        12],
  ['Straum',      13],
  // Coastal facilities
  ['Havn',        14],   ['Småbåthavn', 14],
  ['Ankringsplass', 14],
  ['Molo',        15],   ['Kai',  15],  ['Brygge', 15],
  // Coastal land features
  ['Holme',       16],   ['Holmegruppe', 16],
  ['Øy',          18],   ['Øygruppe', 18],
  ['Halvøy',      20],
  ['Nes',         22],
  ['Strand',      24],
];

/**
 * Place-type priority for LAND locations.
 */
const LAND_PRIORITY_PREFIXES: [string, number][] = [
  ['By',           1],
  ['Tettsted',     2],
  ['Tettbebyggelse', 2],
  ['Bydel',        3],   ['Administrativ bydel', 3],
  ['Grend',        5],   ['Bygdelag', 5],
  ['Øy',           6],
  ['Halvøy',       7],
  ['Vik',          8],
  ['Våg',          8],
  ['Bukt',         8],
  ['Nes',          9],
  ['Havn',        10],   ['Småbåthavn', 10],
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
    if (type.startsWith(prefix)) {return prio;}
  }
  // At sea: unlisted types (land settlements etc.) get 999 so sea features win
  return isSea ? 999 : 50;
}

// ── API fetch helpers ─────────────────────────────────────────────────────

/** Fetch elevation/depth from Kartverket. */
async function fetchElevation(lat: number, lng: number): Promise<{ elevation: number; terrain: string } | null> {
  try {
    const url = `https://ws.geonorge.no/hoydedata/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`;
    const res = await fetch(url);
    if (!res.ok) {return null;}
    const data: GeonorgeElevationResponse = await res.json();
    const pt = data.punkter?.[0];
    if (pt?.z == null) {return null;}
    return { elevation: pt.z, terrain: pt.terreng ?? '' };
  } catch {
    return null;
  }
}

/**
 * Fetch nearby places from Kartverket Stadnamn /punkt.
 * Returns the raw active entries (unsorted) so sorting can be deferred until
 * the sea/land classification from elevation is known.
 *
 * Two-pass: 500 m tight radius first, then 5 000 m if nothing found.
 */
async function fetchNearbyPlaces(lat: number, lng: number): Promise<KartverketPunktEntry[]> {
  const baseUrl = 'https://api.kartverket.no/stedsnavn/v1/punkt';

  const fetchEntries = async (radius: number, limit: number): Promise<KartverketPunktEntry[]> => {
    try {
      const url = `${baseUrl}?nord=${lat}&ost=${lng}&koordsys=4258&radius=${radius}&treffPerSide=${limit}&utkoordsys=4258`;
      const res = await fetch(url);
      if (!res.ok) {return [];}
      const data: KartverketPunktResponse = await res.json();
      return (data.navn ?? []).filter(e => e.stedstatus === 'aktiv');
    } catch {
      return [];
    }
  };

  // Pass 1: tight radius — prefer nearby micro-locations
  const nearby = await fetchEntries(500, 30);
  if (nearby.length > 0) {return nearby;}

  // Pass 2: wider radius for broader context
  return fetchEntries(5000, 50);
}

/**
 * Pick the best place from the nearby entries.
 *
 * Maritime-first logic:
 *  - Sort by type priority (sea features top-ranked when isSea) then distance.
 *  - Coastline edge case: if the elevation says "land" but a definitively
 *    maritime feature is found within 50 m, that feature wins.
 */
function pickBestPlace(
  entries: KartverketPunktEntry[],
  isSea: boolean,
): KartverketPunktEntry | null {
  if (entries.length === 0) {return null;}

  // Coastline edge case: on land but a maritime feature within 50 m → pick it
  if (!isSea) {
    const coastalMaritime = entries.find(
      e => e.meterFraPunkt <= 50 && isMaritimeType(e.navneobjekttype),
    );
    if (coastalMaritime) {return coastalMaritime;}
  }

  // Standard sort: type priority then distance
  const sorted = [...entries].sort((a, b) => {
    const pa = placeTypePriority(a.navneobjekttype, isSea);
    const pb = placeTypePriority(b.navneobjekttype, isSea);
    if (pa !== pb) {return pa - pb;}
    return a.meterFraPunkt - b.meterFraPunkt;
  });

  const best = sorted[0];

  // Only accept if it's a meaningful type or close enough
  if (placeTypePriority(best.navneobjekttype, isSea) <= 25 || best.meterFraPunkt <= 200) {
    return best;
  }

  // Nothing useful in a tight radius — return the best from the wider search
  return best;
}

/**
 * Look up official kommune + fylke from Kartverket Stadnamn /sted endpoint
 * using the stedsnummer returned by /punkt.
 */
async function fetchMunicipalityByStedsnummer(
  stedsnummer: number,
): Promise<{ municipality: string; kommuneNr: string; county: string } | null> {
  try {
    const url = `https://api.kartverket.no/stedsnavn/v1/sted?stedsnummer=${stedsnummer}&filtrer=navn.kommuner,navn.fylker`;
    const res = await fetch(url);
    if (!res.ok) {return null;}
    const data: KartverketStedResponse = await res.json();
    const entry = data.navn?.[0];
    if (!entry) {return null;}

    const kommune = entry.kommuner?.[0];
    const fylke = entry.fylker?.[0];

    return {
      municipality: kommune?.kommunenavn ?? '',
      kommuneNr: kommune?.kommunenummer ?? '',
      county: fylke?.fylkesnavn ?? '',
    };
  } catch {
    return null;
  }
}

/** Fallback: Nominatim reverse geocode (for non-Norwegian locations or API failures). */
async function fetchNominatimName(lat: number, lng: number): Promise<{ name: string; municipality: string; county: string; country: string; displayName: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'User-Agent': 'NoFish/1.0 (fishing conditions app)' } },
    );
    if (!response.ok) {return null;}
    const data = await response.json();
    const address = data.address ?? {};
    return {
      name:
        address.village ?? address.town ?? address.city ?? address.hamlet ??
        address.locality ?? address.suburb ?? address.neighbourhood ??
        address.body_of_water ?? address.bay ?? address.fjord ?? address.strait ??
        address.sea ?? address.ocean ?? address.waterway ?? address.island ??
        address.archipelago ??
        (data.display_name ? data.display_name.split(',')[0].trim() : undefined) ??
        'Unnamed location',
      municipality: address.municipality ?? address.county ?? 'Unknown municipality',
      county: address.county ?? address.state ?? '',
      country: address.country ?? '',
      displayName: data.display_name ?? '',
    };
  } catch {
    return null;
  }
}

// ── Sea / land classification ─────────────────────────────────────────────

const LAND_TERRAIN_TYPES = ['Skog', 'Åpen fastmark', 'Bebygd', 'Innsjø', 'Myr', 'Isbre', 'Fjell'];

function classifySeaLand(
  elev: { elevation: number; terrain: string } | null,
  nearbyEntries: KartverketPunktEntry[],
): boolean {
  // 1. Elevation API returned data — trust terrain type first, then elevation
  if (elev) {
    if (elev.terrain === 'Hav') {return true;}
    if (LAND_TERRAIN_TYPES.includes(elev.terrain)) {return false;}
    return elev.elevation < 0;
  }

  // 2. No elevation data — Kartverket Høydedata covers all Norwegian land,
  //    so a null response means the point is outside coverage (open sea or
  //    foreign territory). Default to sea unless nearby features say otherwise.
  if (nearbyEntries.some(e => isMaritimeType(e.navneobjekttype))) {return true;}
  if (nearbyEntries.length === 0) {return true;}

  // Non-maritime nearby features exist → likely land (e.g. foreign coast)
  return false;
}

// ── Main function ─────────────────────────────────────────────────────────

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult | null> {
  // v9 prefix: cache-bust — results now include objectType + kommuneNr
  const cacheKey = `geo9:${lat.toFixed(4)}:${lng.toFixed(4)}`;

  const cached = await getCached<GeocodingResult>(cacheKey);
  if (cached) {return cached;}

  return withInflight<GeocodingResult | null>(cacheKey, async () => {
    try {
      // Step 1: Elevation and nearby places in parallel.
      // The /punkt call doesn't need isSea — we sort the results afterwards.
      const [elev, nearbyEntries] = await Promise.all([
        fetchElevation(lat, lng),
        fetchNearbyPlaces(lat, lng),
      ]);

      // Step 2: Classify sea/land from elevation + nearby feature signals
      const isSea = classifySeaLand(elev, nearbyEntries);

      // Step 3: Pick best place with maritime-first logic + coastline edge case
      const bestPlace = pickBestPlace(nearbyEntries, isSea);
      const name = bestPlace ? pickName(bestPlace) : '';
      const objectType = bestPlace?.navneobjekttype;
      const placeDistanceM = bestPlace?.meterFraPunkt;

      // Step 4: Municipality from Kartverket /sted (authoritative for Norway)
      let municipality = '';
      let kommuneNr = '';
      let county = '';
      let country = 'Norway';
      let displayName = '';

      if (bestPlace) {
        const sted = await fetchMunicipalityByStedsnummer(bestPlace.stedsnummer);
        if (sted) {
          municipality = sted.municipality;
          kommuneNr = sted.kommuneNr;
          county = sted.county;
        }
      }

      // Step 5: Nominatim fallback — only when Kartverket couldn't supply municipality
      if (!municipality) {
        const nominatim = await fetchNominatimName(lat, lng);
        if (nominatim) {
          if (!name) {
            // No Kartverket name either — use Nominatim for everything
          }
          municipality = nominatim.municipality;
          county = county || nominatim.county;
          country = nominatim.country || 'Norway';
          displayName = nominatim.displayName;
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
        objectType,
        kommuneNr,
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
