import { proxyJSON } from '@/lib/handlers';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyJSON(`/projects/${params.id}`);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  return proxyJSON(`/projects/${params.id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return proxyJSON(`/projects/${params.id}`, { method: 'DELETE' });
}
