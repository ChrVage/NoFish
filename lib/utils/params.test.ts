import { describe, expect, it } from 'vitest';
import { buildLocationUrl, parseZoomParam } from './params';

describe('parseZoomParam', () => {
  it('returns undefined when parameter is absent', () => {
    expect(parseZoomParam(undefined)).toBeUndefined();
  });

  it('parses valid integer strings', () => {
    expect(parseZoomParam('12')).toBe(12);
  });

  it('returns undefined for invalid values', () => {
    expect(parseZoomParam('abc')).toBeUndefined();
  });
});

describe('buildLocationUrl', () => {
  it('builds root URL and formats numeric lat/lng to four decimals', () => {
    const url = buildLocationUrl('', { lat: 63.4305, lng: 10.395123 });
    expect(url).toBe('/?lat=63.4305&lng=10.3951');
  });

  it('builds sub-page URL and includes optional zoom/sea params', () => {
    const url = buildLocationUrl('score', {
      lat: 63.4,
      lng: 10.4,
      zoom: 9,
      sea: 'true',
    });

    expect(url).toBe('/score?lat=63.4000&lng=10.4000&zoom=9&sea=true');
  });

  it('accepts preformatted string coordinates without reformatting', () => {
    const url = buildLocationUrl('details', {
      lat: '63.430512',
      lng: '10.395199',
    });

    expect(url).toBe('/details?lat=63.430512&lng=10.395199');
  });
});
