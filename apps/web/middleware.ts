import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { JWT_SECRET, TOKEN_COOKIE } from './lib/constants';

const PROTECTED = ['/dashboard', '/editor', '/projects', '/billing', '/settings', '/admin'];
const PUBLIC_ONLY = ['/login', '/signup', '/reset-password'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicOnly = PUBLIC_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  let valid = false;
  if (token) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(token, secret);
      valid = true;
    } catch {
      valid = false;
    }
  }

  const response = valid ? NextResponse.next() : NextResponse.next();

  if (isProtected && !valid) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    response.cookies.delete(TOKEN_COOKIE);
    return NextResponse.redirect(url);
  }

  if (isPublicOnly && valid) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (token && !valid && !isProtected) {
    response.cookies.delete(TOKEN_COOKIE);
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/editor/:path*',
    '/projects/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/reset-password',
  ],
};
