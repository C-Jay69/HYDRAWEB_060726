import { API_URL, TOKEN_COOKIE } from './constants';

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  raw?: string;
}

export interface SSEHandlers {
  onEvent?: (event: SSEEvent) => void;
  onStatus?: (message: string) => void;
  onDelta?: (text: string) => void;
  onResult?: (data: Record<string, unknown>) => void;
  onSuggestion?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
  signal?: AbortSignal;
}

/**
 * Consume an SSE stream from the Next.js route handler (which proxies the
 * FastAPI backend). Route handlers pass through text/event-stream untouched.
 */
export async function streamSSE(
  path: string,
  body: Record<string, unknown>,
  handlers: SSEHandlers,
): Promise<void> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    handlers.onError?.(detail || `Request failed (${res.status})`);
    handlers.onDone?.();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 2);
        handleSSELine(chunk, handlers);
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      handlers.onError?.((err as Error).message);
    }
  } finally {
    handlers.onDone?.();
  }
}

function handleSSELine(line: string, handlers: SSEHandlers) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data: ')) return;
  const raw = trimmed.slice(6).trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const type = String(parsed.type || 'message');
  handlers.onEvent?.({ type, data: parsed, raw });
  switch (type) {
    case 'status':
      handlers.onStatus?.(String(parsed.message ?? ''));
      break;
    case 'delta':
      handlers.onDelta?.(String(parsed.text ?? ''));
      break;
    case 'result':
      handlers.onResult?.(parsed.data as Record<string, unknown>);
      break;
    case 'suggestion':
      handlers.onSuggestion?.(parsed.data as Record<string, unknown>);
      break;
    case 'error':
      handlers.onError?.(String(parsed.message ?? 'Unknown error'));
      break;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const json = JSON.parse(text);
      return json.detail || json.message || text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

export { API_URL, TOKEN_COOKIE };
