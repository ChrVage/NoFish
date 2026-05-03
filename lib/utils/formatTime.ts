/**
 * Formats an ISO timestamp as "We 7. 14:30" in the given IANA timezone.
 * Used in the forecast table time column and score page.
 */
export function formatForecastTime(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const day     = parts.find(p => p.type === 'day')?.value     ?? '';
  const hour    = parts.find(p => p.type === 'hour')?.value    ?? '00';
  const minute  = parts.find(p => p.type === 'minute')?.value  ?? '00';
  return `${weekday.slice(0, 2)} ${day}. ${hour}:${minute}`;
}
