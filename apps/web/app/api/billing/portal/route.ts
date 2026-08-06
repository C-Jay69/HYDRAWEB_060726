import { proxyJSON } from '@/lib/handlers';

export async function POST() {
  return proxyJSON('/billing/portal', { method: 'POST' });
}
