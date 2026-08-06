'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Send, Sparkles, Square, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { streamSSE } from '@/lib/sse';
import type { ChatMessage, GeneratedResult } from '@/lib/types';

interface VibePanelProps {
  projectId: string;
  onApply: (result: GeneratedResult) => void;
}

interface PendingSuggestion {
  content: string;
  suggestion: GeneratedResult;
  assistantMessageId: string | null;
}

export function VibePanel({ projectId, onApply }: VibePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<PendingSuggestion | null>(null);
  const [applying, setApplying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/projects/${projectId}/chat`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setMessages(data);
      } catch {
        // ignore — chat history is best-effort on load
      }
    }
    void loadHistory();
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  async function send() {
    const message = input.trim();
    if (!message || streaming) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: message, suggestion: {}, created_at: new Date().toISOString() }]);
    setStreaming(true);
    setPending(null);
    abortRef.current = new AbortController();

    await streamSSE(
      `/api/projects/${projectId}/chat`,
      { message },
      {
        signal: abortRef.current.signal,
        onSuggestion: (data) => {
          const d = data as unknown as { message?: string; suggestion?: GeneratedResult };
          const suggestion = (d.suggestion ?? {}) as GeneratedResult;
          setPending({
            content: d.message || 'Here is an updated version of your site.',
            suggestion,
            assistantMessageId: null,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: d.message || 'Here is an updated version of your site.',
              suggestion,
              created_at: new Date().toISOString(),
            },
          ]);
        },
        onStatus: () => setLoading(false),
        onError: (err) => toast.error(err),
        onDone: () => {
          setStreaming(false);
          setLoading(false);
        },
      },
    );
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
    setLoading(false);
  }

  async function apply() {
    if (!pending) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Applied AI suggestion',
          html: pending.suggestion.html,
          css: pending.suggestion.css,
          js: pending.suggestion.js,
          backend: pending.suggestion.backend,
          db_schema: pending.suggestion.db_schema,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Failed to apply suggestion');
        return;
      }
      toast.success('Suggestion applied — saved as v' + data.version);
      onApply(pending.suggestion);
      setPending(null);
    } catch {
      toast.error('Network error');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-border/60 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <h2 className="text-sm font-semibold">Vibe chat</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">AI suggests · you apply</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streaming && (
          <p className="pt-4 text-center text-xs text-muted-foreground">
            Ask the AI to change your site:
            <br />
            “make the hero section darker”, “add a pricing table”, “fix the contact form”…
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto bg-violet-600/80 text-white'
                : 'bg-accent text-foreground'
            }`}
          >
            {m.content}
          </div>
        ))}
        {streaming && (
          <div className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {pending && (
        <div className="border-t border-border/60 p-3">
          <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-3">
            <p className="text-xs font-semibold text-violet-200">Suggestion ready</p>
            <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{pending.content}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={apply} disabled={applying}>
                {applying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Apply
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPending(null)} disabled={applying}>
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border/60 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Tell the AI what to change…"
            className="min-h-[40px] max-h-32 resize-none text-sm"
            rows={1}
          />
          {streaming ? (
            <Button variant="secondary" size="icon" onClick={stop} title="Stop">
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="icon" onClick={send} disabled={!input.trim()} title="Send">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {loading ? 'Loading context…' : 'Suggestions are saved as new versions when you apply.'}
        </p>
      </div>
    </div>
  );
}
