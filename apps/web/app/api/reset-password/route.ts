import { proxyJSON } from '@/lib/handlers';

export async function POST(req: Request) {
  const body = await req.json();
  return proxyJSON('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) });
}
