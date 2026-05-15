import type { NextConfig } from "next";
import versionInfo from './lib/version.json';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

function getBuildVersion(): string {
  // lib/version.json is committed to the repo and updated by the pre-commit
  // hook. The commit count is used as the version, guaranteeing the same
  // value in dev and prod without depending on git history being available
  // at build time (e.g. on Vercel's shallow clones).
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
