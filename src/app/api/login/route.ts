import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { AUTH_COOKIE, makeToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'SITE_PASSWORD is not configured' }, { status: 500 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  const supplied = Buffer.from(String(password ?? ''));
  const expected = Buffer.from(secret);
  const ok = supplied.length === expected.length && timingSafeEqual(supplied, expected);

  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: makeToken(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
  return response;
}
