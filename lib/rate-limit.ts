import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};

export interface RateLimitOptions {
  interval: number; // milliseconds
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
}

const defaultKeyGenerator = (req: NextRequest): string => {
  return req.headers.get('x-forwarded-for') || 'unknown';
};

export function createRateLimiter(options: RateLimitOptions) {
  const { interval, maxRequests, keyGenerator = defaultKeyGenerator } = options;

  return (req: NextRequest): { allowed: boolean; remaining: number; resetTime: number } => {
    const key = keyGenerator(req);
    const now = Date.now();
    const record = rateLimitStore[key];

    if (!record || now >= record.resetTime) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + interval,
      };
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + interval,
      };
    }

    if (record.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
    };
  };
}

export const rateLimiters = {
  // Strict: 30 requests per minute
  strict: createRateLimiter({
    interval: 60000,
    maxRequests: 30,
  }),

  // Normal: 100 requests per minute
  normal: createRateLimiter({
    interval: 60000,
    maxRequests: 100,
  }),

  // Relaxed: 300 requests per minute
  relaxed: createRateLimiter({
    interval: 60000,
    maxRequests: 300,
  }),

  // Daily: 10000 requests per day
  daily: createRateLimiter({
    interval: 86400000,
    maxRequests: 10000,
  }),
};

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter: ReturnType<typeof createRateLimiter>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { allowed, remaining, resetTime } = limiter(req);

    if (!allowed) {
      const resetDate = new Date(resetTime);
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate.toISOString(),
          },
        }
      );
    }

    const response = await handler(req);
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());

    return response;
  };
}
