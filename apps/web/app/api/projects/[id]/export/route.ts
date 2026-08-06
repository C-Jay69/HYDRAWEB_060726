import { proxyBinary } from '@/lib/handlers';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyBinary(`/projects/${params.id}/export`);
}
