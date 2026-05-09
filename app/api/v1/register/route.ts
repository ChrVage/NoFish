/**
 * POST /api/v1/register
 * Register a new API key for a contact email
 *
 * Request: { email: "user@example.com" }
 * Response: { success: true, key: "...", email: "...", generated_at: "ISO" } or
 *           { success: false, error: "Email already registered", generated_at: "ISO" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { registerApiKey } from '@/lib/db/apiKeys';
import { checkRateLimit } from '@/lib/utils/rateLimit';

interface RegisterRequest {
  email: string;
}

interface RegisterResponse {
  success: boolean;
  key?: string;
  email?: string;
  error?: string;
  generated_at: string;
  source_credit?: string;
}

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=3600' };

// Rate limit registration attempts (per IP): 10 per minute, to prevent email enumeration abuse
const RATE_LIMIT = { name: 'api-v1-register', limit: 10, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  // Check IP-based rate limit
  const limited = checkRateLimit(request, RATE_LIMIT);
  if (limited) {
    return limited;
  }

  const generatedAt = new Date().toISOString();

  try {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Content-Type must be application/json',
          generated_at: generatedAt,
        } satisfies RegisterResponse,
        { status: 400 }
      );
    }

    const body = await request.json() as RegisterRequest;

    // Validate email
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid email field',
          generated_at: generatedAt,
        } satisfies RegisterResponse,
        { status: 400 }
      );
    }

    const email = body.email.trim();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
          generated_at: generatedAt,
        } satisfies RegisterResponse,
        { status: 400 }
      );
    }

    // Email length check (prevent DoS)
    if (email.length > 255) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email too long',
          generated_at: generatedAt,
        } satisfies RegisterResponse,
        { status: 400 }
      );
    }

    // Register the API key
    const apiKey = await registerApiKey(email);

    if (!apiKey) {
      // Email already registered
      return NextResponse.json(
        {
          success: false,
          error: 'Email already registered. Contact support for a new key.',
          generated_at: generatedAt,
        } satisfies RegisterResponse,
        { status: 409, headers: CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        key: apiKey,
        email: email,
        generated_at: generatedAt,
        source_credit: 'API powered by MET Norway, Barentswatch, Kartverket',
      } satisfies RegisterResponse,
      { status: 201, headers: CACHE_HEADERS }
    );
  } catch (error) {
    console.error('Registration API error:', error);
    const generatedAt = new Date().toISOString();
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        generated_at: generatedAt,
      } satisfies RegisterResponse,
      { status: 500 }
    );
  }
}

// Also handle GET for documentation
export async function GET() {
  const generatedAt = new Date().toISOString();
  return NextResponse.json(
    {
      success: true,
      message: 'POST /api/v1/register to obtain an API key',
      example: {
        method: 'POST',
        endpoint: '/api/v1/register',
        body: { email: 'user@example.com' },
        response: {
          success: true,
          key: '<api-key-here>',
          email: 'user@example.com',
        },
      },
      generated_at: generatedAt,
      source_credit: 'API powered by MET Norway, Barentswatch, Kartverket',
    },
    { status: 200 }
  );
}
