import { proxyJSON } from '@/lib/handlers';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyJSON(`/projects/${params.id}/deployments`);
}
