import { proxyJSON } from '@/lib/handlers';

export async function GET(_: Request, { params }: { params: { token: string } }) {
  return proxyJSON(`/auth/verify/${params.token}`);
}
