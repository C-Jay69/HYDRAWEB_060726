import { NextResponse } from 'next/server';

import { TOKEN_COOKIE } from '@/lib/api';

export async function POST() {
  const response = NextResponse.json({ detail: 'Logged out' });
  response.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
