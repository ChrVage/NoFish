import { describe, expect, it, vi } from 'vitest';

const tzlookupMock = vi.hoisted(() => vi.fn());

vi.mock('tz-lookup', () => ({
  default: tzlookupMock,
}));

import { getTimezone, timeAnchor } from './timezone';

describe('getTimezone', () => {
  it('returns timezone from tz-lookup when available', () => {
    tzlookupMock.mockReturnValue('Europe/Oslo');
    expect(getTimezone(63.4305, 10.3951)).toBe('Europe/Oslo');
  });

  it('falls back to UTC if tz-lookup throws', () => {
    tzlookupMock.mockImplementation(() => {
      throw new Error('lookup failed');
    });
    expect(getTimezone(0, 0)).toBe('UTC');
  });
});

describe('timeAnchor', () => {
  it('creates DDHH anchor in UTC', () => {
    expect(timeAnchor('2026-04-18T10:00:00.000Z', 'UTC')).toBe('t-1810');
  });

  it('uses timezone offset for local day and hour', () => {
    // 23:30 UTC is 01:30 next day in Europe/Oslo (summer time)
    expect(timeAnchor('2026-06-30T23:30:00.000Z', 'Europe/Oslo')).toBe('t-0101');
  });
});
