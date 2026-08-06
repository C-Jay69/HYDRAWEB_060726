import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

import { API_URL, JWT_SECRET, TOKEN_COOKIE } from './constants';
import type { User } from './types';

export { API_URL, JWT_SECRET, TOKEN_COOKIE };

export interface Session {
  sub: string;
  email: string;
  role: string;
  plan: string;
}

/** Server-side: decode the JWT from the httpOnly cookie (for display only — data is always enforced by the API). */
export async function getSession(): Promise<Session | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Server-side: call the FastAPI backend with the user's token. */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const cookieStore = cookies();
  const token = cookieStore.get(TOKEN_COOKIE)?.value;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers, cache: 'no-store' });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.sub,
    email: session.email,
    name: session.email.split('@')[0],
    avatar_url: null,
    role: (session.role as User['role']) || 'user',
    is_verified: true,
    created_at: new Date().toISOString(),
    plan: (session.plan as User['plan']) || 'free',
  };
}
