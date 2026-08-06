import { cookies } from 'next/headers';

import { API_URL, TOKEN_COOKIE } from './api';

/** Fetch the FastAPI backend with the user's httpOnly token cookie attached. */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) || {}),
  };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
}

/** Proxy a JSON response (preserves status + body). */
export async function proxyJSON(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await authedFetch(path, init);
  const text = await res.text();
  return new Response(text || JSON.stringify({ detail: res.statusText }), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Proxy an SSE stream from the backend to the browser untouched. */
export async function proxyStream(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await authedFetch(path, init);
  if (!res.ok || !res.body) {
    const text = await res.text();
    return new Response(text || res.statusText, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Proxy a binary response (ZIP export). */
export async function proxyBinary(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await authedFetch(path, init);
  if (!res.ok) {
    const text = await res.text();
    return new Response(text || res.statusText, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': res.headers.get('content-disposition') || '',
    },
  });
}
