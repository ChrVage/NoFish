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
