import { proxyJSON, proxyStream } from '@/lib/handlers';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  return proxyStream(`/projects/${params.id}/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyJSON(`/projects/${params.id}/chat`);
}
