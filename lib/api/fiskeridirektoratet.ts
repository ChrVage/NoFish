const BASE_URL =
  'https://gis.fiskeridir.no/server/rest/services/FiskeridirWFS_fiskeri/MapServer';

/**
 * Layers queried for fishing restrictions / protection zones.
 * Each entry maps an ArcGIS layer id to a human-readable label and a severity
 * category so the UI can differentiate hard prohibitions from informational
 * spawning-area notices.
 */
const RESTRICTION_LAYERS = [
  { id: 78, label: 'Stengt fiskefelt (J-melding)', type: 'closure' as const },
  { id: 75, label: 'Høstingsforskriften', type: 'regulation' as const },
  { id: 136, label: 'Kysttorsk forbudsområde', type: 'prohibition' as const },
  { id: 137, label: 'Stengt gytefelt (jan–apr)', type: 'seasonal' as const },
  { id: 94, label: 'Torsk gyteområde forbud', type: 'seasonal' as const },
  { id: 85, label: 'Torsk oppvekstområde forbud', type: 'seasonal' as const },
  { id: 141, label: 'Nullfiskeområde', type: 'prohibition' as const },
  { id: 28, label: 'Korallrev forbudsområde', type: 'prohibition' as const },
  { id: 105, label: 'Gyteområde', type: 'info' as const },
  { id: 109, label: 'Oppvekst-/beiteområde', type: 'info' as const },
] as const;

export type ZoneType = (typeof RESTRICTION_LAYERS)[number]['type'];

export interface ProtectionZone {
  layerName: string;
  type: ZoneType;
  name: string;
  description?: string;
  url?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Query Fiskeridirektoratet ArcGIS REST API for all restriction / protection
 * zone polygons that intersect the given WGS-84 point.
 */
export async function queryProtectionZones(
  lat: number,
  lng: number,
): Promise<ProtectionZone[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const queries = RESTRICTION_LAYERS.map(async (layer) => {
      const url =
        `${BASE_URL}/${layer.id}/query?` +
        new URLSearchParams({
          geometry: `${lng},${lat}`,
          geometryType: 'esriGeometryPoint',
          inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: '*',
          returnGeometry: 'false',
          f: 'json',
        });

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          next: { revalidate: 3600 },
        });
        if (!res.ok) { return []; }
        const data = await res.json();
        return (data.features ?? []).map((f: { attributes: Record<string, unknown> }) =>
          parseFeature(f.attributes, layer),
        );
      } catch {
        return [];
      }
    });

    const results = await Promise.all(queries);
    return results.flat();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseFeature(
  attrs: Record<string, unknown>,
  layer: (typeof RESTRICTION_LAYERS)[number],
): ProtectionZone {
  const s = (key: string) => (typeof attrs[key] === 'string' ? (attrs[key] as string) : undefined);

  return {
    layerName: layer.label,
    type: layer.type,
    name: s('navn') ?? s('label') ?? s('omraade') ?? layer.label,
    description: s('beskrivelse') ?? s('info') ?? s('informasjon') ?? undefined,
    url: s('url') ?? s('lovdata') ?? undefined,
    dateFrom: formatEsriDate(attrs.dato_fra ?? attrs.jmelding_fra_dato ?? attrs.stengt_dato),
    dateTo: formatEsriDate(attrs.dato_til ?? attrs.jmelding_til_dato ?? attrs.aapnet_dato),
  };
}

function formatEsriDate(value: unknown): string | undefined {
  if (typeof value !== 'number' || !value) { return undefined; }
  return new Date(value).toISOString().slice(0, 10);
}
