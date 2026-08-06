import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/editor', '/projects', '/billing', '/settings'];
const PUBLIC_ONLY = ['/login', '/signup', '/reset-password'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('hydraweb_token')?.value;
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isPublicOnly = PUBLIC_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isPublicOnly && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/editor/:path*',
    '/projects/:path*',
    '/billing/:path*',
    '/settings/:path*',
    '/login',
    '/signup',
    '/reset-password',
  ],
};
