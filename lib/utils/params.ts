/**
 * Parse a zoom URL search parameter string into a valid integer zoom level.
 * Returns `undefined` if the value is absent or not a valid integer.
 */
export function parseZoomParam(zoomStr?: string): number | undefined {
  if (zoomStr === undefined) return undefined;
  const zoom = parseInt(zoomStr, 10);
  return isNaN(zoom) ? undefined : zoom;
}
