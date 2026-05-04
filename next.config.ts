import type { NextConfig } from "next";
import { execSync } from 'child_process';
import { version } from './package.json';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

function getBuildVersion(): string {
  let sha = '';

  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* git not available or failed */ }

  // Fallback: Vercel exposes the commit SHA at build time
  if (!sha) {sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? '';}

  if (sha) {return `${version} (${sha})`;}
  return version;
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
