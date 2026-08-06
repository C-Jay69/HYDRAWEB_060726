import { proxyStream } from '@/lib/handlers';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  return proxyStream(`/projects/${params.id}/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
