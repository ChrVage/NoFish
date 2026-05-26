import type { NextConfig } from "next";
import { execSync } from 'node:child_process';
import versionInfo from './lib/version.json';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

function getBuildVersion(): string {
  // Prefer the live commit count at build time so the displayed build always
  // matches HEAD even when the pre-commit hook was skipped (e.g. commits made
  // through the GitHub web UI). Fall back to the committed lib/version.json
  // when git history isn't available (e.g. Vercel shallow clones).
  try {
    const live = parseInt(
      execSync('git rev-list --count HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(),
      10,
    );
    if (Number.isFinite(live) && live > 0) {return String(live);}
  } catch {
    // ignore — fall through to the committed file
  }
  const { commits } = versionInfo as { commits: number };
  return String(commits);
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cache.kartverket.no",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_VERSION: getBuildVersion(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer-when-downgrade' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
