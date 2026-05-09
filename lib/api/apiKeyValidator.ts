/**
 * API key validation utility for v1 API endpoints
 * Extracts X-Api-Key header and validates against database
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, getKeyRequestCount, incrementKeyRequestCount } from '@/lib/db/apiKeys';
import { checkApiKeyRateLimit, type PerKeyRateLimitConfig } from '@/lib/utils/rateLimit';

export interface ValidatedApiRequest {
  isValid: boolean;
  apiKey?: string;
  email?: string;
  error?: string;
  rateLimitResponse?: NextResponse;
}

/**
 * Validate API key from X-Api-Key header and check rate limits
 * Returns error response if invalid or rate-limited, otherwise null
 */
export async function validateApiKeyHeader(
  request: NextRequest,
  rateLimitConfig: PerKeyRateLimitConfig
): Promise<NextResponse | null> {
  const apiKey = request.headers.get('X-Api-Key')?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing X-Api-Key header',
        generated_at: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  // Validate key format (should be 64 hex chars from generateApiKey)
  if (!/^[a-f0-9]{64}$/.test(apiKey)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid API key format',
        generated_at: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  try {
    // Check if key exists and is valid
    const keyRecord = await validateApiKey(apiKey);
    if (!keyRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid API key',
          generated_at: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Get current request count for rate limiting
    const { today: requestsToday } = await getKeyRequestCount(apiKey);

    // Check rate limits (daily + per-minute)
    const rateLimitError = checkApiKeyRateLimit(apiKey, rateLimitConfig, requestsToday);
    if (rateLimitError) {
      return rateLimitError;
    }

    return null; // All checks passed
  } catch (error) {
    console.error('API key validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        generated_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Record a successful API request (increments counters)
 */
export async function recordApiRequest(apiKey: string): Promise<void> {
  try {
    await incrementKeyRequestCount(apiKey);
  } catch (error) {
    console.error('Error recording API request:', error);
    // Don't throw - this is telemetry, not critical
  }
}
