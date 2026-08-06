import { redirect } from 'next/navigation';

import { EditorPage } from '@/components/editor/editor-page';
import { apiFetch, getCurrentUser } from '@/lib/api';
import type { Deployment, Project, VersionDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EditorRoute({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams?: { prompt?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [projRes, verRes, depRes] = await Promise.all([
    apiFetch<Project>(`/projects/${params.projectId}`),
    apiFetch<VersionDetail[]>(`/projects/${params.projectId}/versions`),
    apiFetch<Deployment[]>(`/projects/${params.projectId}/deployments`),
  ]);

  const project = projRes.ok ? (projRes.data as Project) : null;
  if (!project) {
    redirect('/projects');
  }

  const versions: VersionDetail[] = verRes.ok && Array.isArray(verRes.data) ? verRes.data : [];
  const deployments: Deployment[] = depRes.ok && Array.isArray(depRes.data) ? depRes.data : [];

  const initialVersion = versions.length > 0 ? versions[0] : null;
  const initialPrompt = searchParams?.prompt || project.prompt || '';
  const autoGenerate = !!initialPrompt && !initialVersion;

  return (
    <EditorPage
      projectId={params.projectId}
      initialProject={project}
      initialVersion={initialVersion}
      initialDeployments={deployments}
      initialPrompt={initialPrompt}
      autoGenerate={autoGenerate}
    />
  );
}
