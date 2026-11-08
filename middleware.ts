import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/auth/login', '/auth/register', '/auth/callback', '/', '/api/auth'];
const protectedPaths = ['/dashboard', '/api'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  // Get token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // Public paths are always allowed
  if (isPublicPath) {
    // If already logged in and on auth page, redirect to dashboard
    if (pathname.startsWith('/auth') && pathname !== '/auth/callback' && token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // If trying to access protected route without token
  if (isProtectedPath && !token && pathname !== '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
