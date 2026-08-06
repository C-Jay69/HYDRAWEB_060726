import { proxyJSON } from '@/lib/handlers';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  return proxyJSON(`/users/me/api-keys/${params.id}`, { method: 'DELETE' });
}
