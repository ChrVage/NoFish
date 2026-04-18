import tzlookup from 'tz-lookup';

/**
 * Return the IANA timezone identifier for a coordinate pair.
 * tz-lookup bundles its geo data as JavaScript — no file system access,
 * works in all serverless / edge environments.
 * Falls back to 'UTC' for any coordinates that don't resolve (e.g. open ocean).
 *
 * @example getTimezone(59.91, 10.75) → 'Europe/Oslo'
 */
export function getTimezone(lat: number, lng: number): string {
  try {
    return tzlookup(lat, lng) ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Return a human-readable timezone label derived from the actual IANA rules,
 * so DST is always reflected correctly.
 *
 * @example getTimezoneLabel('Europe/Oslo') → 'Europe/Oslo (GMT+2)'
 */
export function getTimezoneLabel(timezone: string): string {
  const offset = new Intl.DateTimeFormat('en', {
    timeZoneName: 'shortOffset',
    timeZone: timezone,
  })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  return `${timezone} (${offset})`;
}

/**
 * Short anchor id for a forecast hour: `t-DDHH` in the given timezone.
 * E.g. 2026-04-18T10:00:00Z in Europe/Oslo → `t-1812` (day 18, hour 12 local).
 */
export function timeAnchor(isoString: string, timezone: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', hour: '2-digit', hour12: false, timeZone: timezone,
  }).formatToParts(d);
  const day = parts.find(p => p.type === 'day')?.value ?? '00';
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
  return `t-${day}${hour}`;
}
