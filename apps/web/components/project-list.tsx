'use client';

import { useState } from 'react';
import { ArrowUpRight, GitBranch, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';
import type { Project } from '@/lib/types';

export function ProjectList({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${deleting.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete project');
        return;
      }
      toast.success('Project deleted');
      setDeleting(null);
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <div key={project.id} className="group relative rounded-2xl border bg-card p-5 transition-colors hover:border-violet-500/40">
            <Link href={`/editor/${project.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight group-hover:text-violet-200">{project.name}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-violet-300" />
              </div>
              {project.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
              )}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="capitalize">{project.status}</Badge>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3 w-3" /> v{project.latest_version}
              </span>
              <span className="ml-auto">{formatDate(project.updated_at)}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              onClick={() => setDeleting(project)}
              title="Delete project"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project, its versions and chat history. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
