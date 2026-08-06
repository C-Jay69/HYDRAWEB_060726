import { redirect } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { ProjectList } from '@/components/project-list';
import { apiFetch, getCurrentUser } from '@/lib/api';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { ok, data } = await apiFetch<Project[]>('/projects');
  const projects: Project[] = ok && Array.isArray(data) ? data : [];

  return (
    <AppShell user={user}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage everything you are building.</p>
        </div>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-16 text-center text-sm text-muted-foreground">
          No projects yet — create your first one to get started.
        </div>
      ) : (
        <ProjectList projects={projects} />
      )}
    </AppShell>
  );
}
