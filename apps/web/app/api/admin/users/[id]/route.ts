import { proxyJSON } from '@/lib/handlers';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  return proxyJSON(`/admin/users/${params.id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
