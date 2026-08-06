import { proxyJSON } from '@/lib/handlers';

export async function GET(_: Request, { params }: { params: { id: string; version: string } }) {
  return proxyJSON(`/projects/${params.id}/versions/${params.version}`);
}

export async function POST(_: Request, { params }: { params: { id: string; version: string } }) {
  return proxyJSON(`/projects/${params.id}/versions/${params.version}/rollback`, { method: 'POST' });
}
