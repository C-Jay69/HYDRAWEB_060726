import { proxyJSON } from '@/lib/handlers';

export async function GET() {
  return proxyJSON('/users/me/api-keys');
}

export async function POST(req: Request) {
  const body = await req.json();
  return proxyJSON('/users/me/api-keys', { method: 'POST', body: JSON.stringify(body) });
}
