import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { checkRateLimit } from './rateLimit';

function mkRequest(ip?: string): NextRequest {
  const headers = new Headers();
  if (ip) {headers.set('x-forwarded-for', ip);}
  return { headers } as unknown as NextRequest;
}

let limiterSeq = 0;
function limiterName(prefix: string): string {
  limiterSeq += 1;
  return `${prefix}-${limiterSeq}`;
}

describe('checkRateLimit', () => {
  it('allows requests up to the configured limit', () => {
    const name = limiterName('allow');
    const config = { name, limit: 2, windowSeconds: 60 };
    const req = mkRequest('1.2.3.4');

    expect(checkRateLimit(req, config)).toBeNull();
    expect(checkRateLimit(req, config)).toBeNull();
  });

  it('returns 429 with headers when limit is exceeded', async () => {
    const name = limiterName('exceed');
    const config = { name, limit: 1, windowSeconds: 60 };
    const req = mkRequest('1.2.3.4');

    expect(checkRateLimit(req, config)).toBeNull();
    const blocked = checkRateLimit(req, config);

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('X-RateLimit-Limit')).toBe('1');
    expect(blocked?.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    await expect(blocked?.json()).resolves.toMatchObject({
      success: false,
      error: 'Too many requests',
    });
  });

  it('tracks different limiter names independently', () => {
    const req = mkRequest('1.2.3.4');
    const a = { name: limiterName('a'), limit: 1, windowSeconds: 60 };
    const b = { name: limiterName('b'), limit: 1, windowSeconds: 60 };

    expect(checkRateLimit(req, a)).toBeNull();
    expect(checkRateLimit(req, b)).toBeNull();
    expect(checkRateLimit(req, a)?.status).toBe(429);
    expect(checkRateLimit(req, b)?.status).toBe(429);
  });

  it('tracks different IPs independently', () => {
    const name = limiterName('ips');
    const config = { name, limit: 1, windowSeconds: 60 };

    expect(checkRateLimit(mkRequest('1.2.3.4'), config)).toBeNull();
    expect(checkRateLimit(mkRequest('5.6.7.8'), config)).toBeNull();
  });

  it('allows requests again after the window resets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));

    const name = limiterName('reset');
    const config = { name, limit: 1, windowSeconds: 10 };
    const req = mkRequest('9.9.9.9');

    expect(checkRateLimit(req, config)).toBeNull();
    expect(checkRateLimit(req, config)?.status).toBe(429);

    vi.advanceTimersByTime(11_000);
    expect(checkRateLimit(req, config)).toBeNull();

    vi.useRealTimers();
  });
});
