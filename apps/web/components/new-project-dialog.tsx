'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function NewProjectDialog({ initialPrompt = '' }: { initialPrompt?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialPrompt);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error('Give your project a name');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: '',
          visibility: 'private',
          prompt: prompt.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Failed to create project');
        return;
      }
      toast.success('Project created');
      setOpen(false);
      if (prompt.trim()) {
        router.push(`/editor/${data.id}?prompt=${encodeURIComponent(prompt.trim())}`);
      } else {
        router.push(`/editor/${data.id}`);
      }
      router.refresh();
    } catch {
      toast.error('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Describe what you want to build — or create an empty project and add content in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My landing page"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-prompt">Prompt (optional)</Label>
            <Textarea
              id="proj-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="A SaaS landing page with dark mode, pricing section and a contact form…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
