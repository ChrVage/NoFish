import { NextRequest, NextResponse } from 'next/server';

interface KartverketSkrivemate {
  skrivemåte: string;
  navneobjekttype: string;
  representasjonspunkt?: { nord: number; øst: number; koordsys: number };
  kommuner?: { kommunenavn: string; kommunenummer: string }[];
  stedstatus?: string;
}

interface KartverketNavnResponse {
  metadata: { totaltAntallTreff: number };
  navn: KartverketSkrivemate[];
}

export interface SearchResult {
  name: string;
  type: string;
  municipality: string;
  lat: number;
  lng: number;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' };

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] }, { headers: CACHE_HEADERS });
  }

  // Sanitise: max 100 chars, strip control characters
  const sanitised = q.slice(0, 100).replace(/[\x00-\x1f]/g, '');

  try {
    const url = new URL('https://api.kartverket.no/stedsnavn/v1/navn');
    url.searchParams.set('sok', `${sanitised}*`);
    url.searchParams.set('fuzzy', 'true');
    url.searchParams.set('treffPerSide', '8');
    url.searchParams.set('utkoordsys', '4258');

    const response = await fetch(url.toString());
    if (!response.ok) {
      return NextResponse.json({ results: [] }, { headers: CACHE_HEADERS });
    }

    const data: KartverketNavnResponse = await response.json();

    const results: SearchResult[] = [];
    const seen = new Set<string>();

    for (const entry of data.navn ?? []) {
      const pt = entry.representasjonspunkt;
      if (!pt || pt.nord == null || pt.øst == null) continue;

      const name = entry.skrivemåte;
      const municipality = entry.kommuner?.[0]?.kommunenavn ?? '';
      const key = `${name}|${municipality}|${pt.nord.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        name,
        type: entry.navneobjekttype ?? '',
        municipality,
        lat: pt.nord,
        lng: pt.øst,
      });

      if (results.length >= 6) break;
    }

    return NextResponse.json({ results }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ results: [] }, { status: 200, headers: CACHE_HEADERS });
  }
}
