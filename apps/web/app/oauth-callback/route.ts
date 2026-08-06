import { NextResponse } from 'next/server';

import { TOKEN_COOKIE } from '@/lib/api';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const response = NextResponse.redirect(new URL('/dashboard', req.url));
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
