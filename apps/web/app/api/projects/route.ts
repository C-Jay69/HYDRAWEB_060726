import { proxyJSON } from '@/lib/handlers';

export async function GET() {
  return proxyJSON('/projects');
}

export async function POST(req: Request) {
  const body = await req.json();
  return proxyJSON('/projects', { method: 'POST', body: JSON.stringify(body) });
}
