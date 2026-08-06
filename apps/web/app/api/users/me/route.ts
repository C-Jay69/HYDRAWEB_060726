import { proxyJSON } from '@/lib/handlers';

export async function GET() {
  return proxyJSON('/users/me');
}

export async function PATCH(req: Request) {
  const body = await req.json();
  return proxyJSON('/users/me', { method: 'PATCH', body: JSON.stringify(body) });
}
