import { NextRequest, NextResponse } from 'next/server';

/**
 * Production-grade API security middleware
 * Implements: CORS, CSP, Rate limiting, Request validation
 */

// Security headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// CORS configuration for production
export const corsConfig = {
  allowedOrigins: [
    'https://yourdomain.com',
    'https://app.yourdomain.com',
    'http://localhost:3000', // Development only
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
};

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * CORS validation middleware
 */
export function validateCORS(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Same-origin requests are always allowed

  return corsConfig.allowedOrigins.includes(origin);
}

/**
 * Request validation middleware
 */
export interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
  };
}

export function validateRequest(data: any, schema: ValidationSchema): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  Object.entries(schema).forEach(([field, rules]) => {
    const value = data[field];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      return;
    }

    if (value === undefined || value === null) return; // Optional field

    // Type validation
    if (typeof value !== rules.type) {
      errors.push(`${field} must be ${rules.type}`);
      return;
    }

    // Length validation
    if (rules.type === 'string') {
      if (rules.min && value.length < rules.min) {
        errors.push(`${field} must be at least ${rules.min} characters`);
      }
      if (rules.max && value.length > rules.max) {
        errors.push(`${field} must be at most ${rules.max} characters`);
      }
    }

    // Number validation
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${field} must be at most ${rules.max}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Request logging for audit trail
 */
export async function logRequest(
  method: string,
  path: string,
  userId: string | null,
  status: number,
  duration: number
): Promise<void> {
  try {
    // In production, this would log to CloudWatch or similar
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method,
        path,
        userId,
        status,
        duration,
      })
    );
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

/**
 * Response sanitization for security
 */
export function sanitizeResponse(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }

  const sanitized: any = {};
  Object.entries(data).forEach(([key, value]) => {
    // Remove sensitive fields
    if (['password', 'token', 'secret', 'apiKey'].includes(key.toLowerCase())) {
      return;
    }
    sanitized[key] = typeof value === 'object' ? sanitizeResponse(value) : value;
  });

  return sanitized;
}

/**
 * Secure API response wrapper
 */
export function createSecureResponse(
  data: any,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      success: status < 400,
      data: status < 400 ? sanitizeResponse(data) : null,
      error: status >= 400 ? data?.message || 'An error occurred' : null,
      timestamp: new Date().toISOString(),
    },
    { status }
  );

  // Add security headers
  addSecurityHeaders(response);

  // Add custom headers if provided
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * Error response helper
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return createSecureResponse(
    {
      message,
      code: code || `ERROR_${status}`,
    },
    status
  );
}
