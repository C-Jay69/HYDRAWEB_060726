import { NextResponse } from 'next/server';

import { API_URL, TOKEN_COOKIE } from '@/lib/api';

export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) {
    return new Response(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  }
  const data = JSON.parse(text);
  const response = NextResponse.json(data, { status: 200 });
  response.cookies.set(TOKEN_COOKIE, data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
