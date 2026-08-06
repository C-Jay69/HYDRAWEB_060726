import type { User } from './types';

export interface ClientResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Client-side fetch against the Next.js proxy routes. The httpOnly
 * `hydraweb_token` cookie is attached automatically by the browser.
 */
export async function clientAPI<T = unknown>(path: string, init: RequestInit = {}): Promise<ClientResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string> | undefined) || {}),
  };
  const res = await fetch(`/api${path}`, { ...init, headers, cache: 'no-store' });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

/** Client-side session check: returns the current user or null when logged out. */
export async function clientUser(): Promise<User | null> {
  const res = await clientAPI<User>('/me');
  return res.ok ? (res.data as User) : null;
}
