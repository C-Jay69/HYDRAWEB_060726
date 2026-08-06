import { proxyJSON } from '@/lib/handlers';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  return proxyJSON(`/projects/${params.id}/apply`, { method: 'POST', body: JSON.stringify(body) });
}
