import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;

  const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

  // If user has active session and tries to visit auth routes, keep them on /servers
  if (sessionToken && authRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/servers', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ],
};

