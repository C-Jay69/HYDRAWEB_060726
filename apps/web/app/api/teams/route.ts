import { proxyJSON } from '@/lib/handlers';

export async function GET() {
  return proxyJSON('/teams');
}
