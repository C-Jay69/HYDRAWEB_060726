import { ArrowUpRight, FolderPlus, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch, getCurrentUser } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { prompt?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { ok, data } = await apiFetch<Project[]>('/projects');
  const projects: Project[] = ok && Array.isArray(data) ? data : [];
  const prompt = searchParams?.prompt || '';

  return (
    <AppShell user={user}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} project{projects.length === 1 ? '' : 's'} · {user.plan} plan
          </p>
        </div>
        <NewProjectDialog initialPrompt={prompt} />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center">
          <FolderPlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create a project and describe your website in plain English. HydraWeb will generate the
            frontend, backend and database — then you can refine it together.
          </p>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/editor/${project.id}`}
              className="group rounded-2xl border bg-card p-5 transition-colors hover:border-violet-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight group-hover:text-violet-200">
                  {project.name}
                </h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-violet-300" />
              </div>
              {project.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="capitalize">
                  {project.status}
                </Badge>
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  v{project.latest_version}
                </span>
                <span className="ml-auto">{formatDate(project.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
