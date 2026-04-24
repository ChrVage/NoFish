import type { BoatSizePreset, FishTarget, FishingMethod } from '@/lib/utils/tuning';

export interface LocationSearchParams {
  lat?: string;
  lng?: string;
  zoom?: string;
  sea?: string;
  boat?: string;
  fish?: string;
  method?: string;
}

/**
 * Parse a zoom URL search parameter string into a valid integer zoom level.
 * Returns `undefined` if the value is absent or not a valid integer.
 */
export function parseZoomParam(zoomStr?: string): number | undefined {
  if (zoomStr === undefined) {return undefined;}
  const zoom = parseInt(zoomStr, 10);
  return isNaN(zoom) ? undefined : zoom;
}

/**
 * Build a location URL for page navigation.
 * Centralises the `?lat=…&lng=…&zoom=…&sea=…` pattern used across the app.
 *
 * @param page  Route segment: '' (home), 'score', 'details', 'tide'
 * @param opts  Coordinate and optional params
 */
export function buildLocationUrl(
  page: '' | 'score' | 'details' | 'tide',
  opts: {
    lat: number | string;
    lng: number | string;
    zoom?: number | string;
    sea?: string;
    boat?: BoatSizePreset;
    fish?: FishTarget;
    method?: FishingMethod;
  },
): string {
  const lat = typeof opts.lat === 'number' ? opts.lat.toFixed(4) : opts.lat;
  const lng = typeof opts.lng === 'number' ? opts.lng.toFixed(4) : opts.lng;
  const params = new URLSearchParams({ lat, lng });
  if (opts.zoom !== undefined) {params.set('zoom', String(opts.zoom));}
  if (opts.sea !== undefined) {params.set('sea', opts.sea);}
  if (opts.boat !== undefined) {params.set('boat', opts.boat);}
  if (opts.fish !== undefined) {params.set('fish', opts.fish);}
  if (opts.method !== undefined) {params.set('method', opts.method);}
  const prefix = page ? `/${page}` : '/';
  return `${prefix}?${params.toString()}`;
}
