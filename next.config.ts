import type { NextConfig } from "next";
import { execSync } from 'child_process';

function getBuildVersion(): string {
  let count = '';
  let sha = '';

  try {
    // Vercel does a shallow clone; unshallow first so rev-list counts all commits
    try { execSync('git fetch --unshallow', { encoding: 'utf-8', stdio: 'ignore' }); } catch { /* already full */ }
    count = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* git not available or failed */ }

  // Fallback: Vercel exposes the commit SHA at build time
  if (!sha) sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? '';

  if (count && count !== '0' && sha) return `${count} (${sha})`;
  if (count && count !== '0') return count;
  if (sha) return sha;
  return '0';
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cache.kartverket.no",
  "font-src 'self' https://fonts.gstatic.com",
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

export default nextConfig;
