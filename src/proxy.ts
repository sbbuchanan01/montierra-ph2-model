import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifyToken } from '@/lib/auth';

/**
 * Site-wide password gate (Next 16 proxy, Node runtime).
 * A signed, expiring cookie is issued by /api/login; everything except the
 * login flow and static assets requires it. If SITE_PASSWORD is not set
 * (e.g. local dev without .env.local), the gate is open.
 */
export function proxy(request: NextRequest) {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/login')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (verifyToken(token, secret)) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)'],
};
