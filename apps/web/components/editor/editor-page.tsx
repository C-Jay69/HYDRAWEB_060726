'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GjsEditor from '@grapesjs/react';
import grapesjs, { type Editor as GjsEditorInstance } from 'grapesjs';
import {
  ArrowLeft,
  CloudUpload,
  Download,
  ExternalLink,
  FileCode2,
  Globe,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { VibePanel } from '@/components/editor/vibe-panel';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { streamSSE } from '@/lib/sse';
import type { Deployment, GeneratedResult, Project, VersionDetail } from '@/lib/types';
import 'grapesjs/dist/css/grapes.min.css';

interface EditorPageProps {
  projectId: string;
  initialProject: Project;
  initialVersion: VersionDetail | null;
  initialDeployments: Deployment[];
  initialPrompt: string;
  autoGenerate: boolean;
}

export function EditorPage({
  projectId,
  initialProject,
  initialVersion,
  initialDeployments,
  initialPrompt,
  autoGenerate,
}: EditorPageProps) {
  const [project, setProject] = useState(initialProject);
  const [version, setVersion] = useState<VersionDetail | null>(initialVersion);
  const [deployments, setDeployments] = useState(initialDeployments);
  const [editor, setEditor] = useState<GjsEditorInstance | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState(initialPrompt || project.prompt);
  const [includeBackend, setIncludeBackend] = useState(true);
  const [includeDb, setIncludeDb] = useState(true);
  const [genLog, setGenLog] = useState<string[]>([]);
  const [deployOpen, setDeployOpen] = useState(false);
  const [subdomain, setSubdomain] = useState(project.slug);
  const [deploying, setDeploying] = useState(false);
  const jsRef = useRef('');
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedEditor = useRef(false);

  const liveUrl = deployments.find((d) => d.status === 'live')?.target_url || null;

  const applyContent = useCallback(
    (html: string, css: string, js: string) => {
      jsRef.current = js;
      if (editor) {
        try {
          editor.setComponents(html);
          if (css) editor.setStyle(css);
          else editor.Css.clear();
        } catch (err) {
          toast.error('Could not load content into the editor: ' + (err as Error).message);
        }
      }
    },
    [editor],
  );

  const loadVersion = useCallback(
    async (v: VersionDetail) => {
      setVersion(v);
      applyContent(v.html, v.css, v.js);
    },
    [applyContent],
  );

  const reload = useCallback(async () => {
    const [projRes, verRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/versions`),
    ]);
    if (projRes.ok) setProject((await projRes.json()) as Project);
    if (verRes.ok) {
      const list = (await verRes.json()) as VersionDetail[];
      if (list.length > 0) await loadVersion(list[0]);
    }
    const depRes = await fetch(`/api/projects/${projectId}/deployments`);
    if (depRes.ok) setDeployments((await depRes.json()) as Deployment[]);
  }, [projectId, loadVersion]);

  // Auto-generate when arriving with a prompt and no content.
  useEffect(() => {
    if (autoGenerate && !initialVersion) {
      startGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load version content into the editor once it is ready.
  useEffect(() => {
    if (editor && version && !hasLoadedEditor.current) {
      hasLoadedEditor.current = true;
      applyContent(version.html, version.css, version.js);
    }
  }, [editor, version, applyContent]);

  async function startGenerate() {
    const prompt = genPrompt.trim();
    if (!prompt) {
      toast.error('Describe the site you want to build');
      return;
    }
    setGenOpen(true);
    setGenerating(true);
    setGenLog([]);
    abortRef.current = new AbortController();

    await streamSSE(
      `/api/projects/${projectId}/generate`,
      { prompt, include_backend: includeBackend, include_db: includeDb },
      {
        signal: abortRef.current.signal,
        onStatus: (msg) => setGenLog((prev) => [...prev, msg]),
        onResult: async (data) => {
          const d = data as unknown as { summary?: string } & GeneratedResult;
          setGenLog((prev) => [...prev, 'Generation complete']);
          await reload();
          if (d.summary) toast.success(d.summary.slice(0, 120));
        },
        onError: (err) => toast.error(err),
        onDone: () => {
          setGenerating(false);
          if (version) setGenOpen(false);
        },
      },
    );
  }

  function stopGenerate() {
    abortRef.current?.abort();
    setGenerating(false);
  }

  async function saveCurrent() {
    if (!editor) return;
    try {
      const html = editor.getHtml();
      const css = editor.getCss();
      const res = await fetch(`/api/projects/${projectId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Manual save from editor',
          html,
          css,
          js: jsRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Failed to save');
        return;
      }
      toast.success('Saved as version ' + data.version);
      await reload();
    } catch {
      toast.error('Network error');
    }
  }

  async function deploy() {
    if (!subdomain.trim()) {
      toast.error('Enter a subdomain');
      return;
    }
    setDeploying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: subdomain.trim(), env_vars: {} }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Deploy failed');
        return;
      }
      toast.success('Deployed to ' + data.target_url);
      setDeployOpen(false);
      setDeployments((prev) => [data, ...prev]);
    } catch {
      toast.error('Network error');
    } finally {
      setDeploying(false);
    }
  }

  async function exportZip() {
    try {
      const res = await fetch(`/api/projects/${projectId}/export`);
      if (!res.ok) {
        toast.error('Nothing to export yet');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Network error');
    }
  }

  const editorOptions = {
    height: '100%',
    storageManager: false,
    fromElement: false,
  } as const;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon" title="Back to projects">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{project.name}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>v{project.latest_version}</span>
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> live
              </a>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Versions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
              {version ? (
                <>
                  <DropdownMenuItem disabled className="font-medium text-muted-foreground">
                    Version {version.version} — {version.message || 'Current'}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="border-t text-[11px] text-muted-foreground">
                    Rollback management coming soon.
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled>No versions yet</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={exportZip}>
            <Download className="mr-2 h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeployOpen(true)}>
            <CloudUpload className="mr-2 h-3.5 w-3.5" />
            Deploy
          </Button>
          <Button variant="outline" size="sm" onClick={saveCurrent}>
            <FileCode2 className="mr-2 h-3.5 w-3.5" />
            Save
          </Button>
          <Button size="sm" onClick={() => { setGenOpen(true); setGenerating(false); }} disabled={generating}>
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            {version ? 'Regenerate' : 'Generate'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {version ? (
            <GjsEditor
              grapesjs={grapesjs}
              onEditor={setEditor}
              options={{ ...editorOptions, height: '100%' }}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-card/40 p-8">
              <div className="w-full max-w-lg text-center">
                <Wand2 className="mx-auto h-10 w-10 text-violet-400" />
                <h2 className="mt-4 text-xl font-bold">Generate your website</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Describe what you want to build. HydraWeb will generate the HTML, CSS, browser JS,
                  backend code and database schema — saved as version 1.
                </p>
                <div className="mt-6 space-y-3 text-left">
                  <div className="space-y-1.5">
                    <Label htmlFor="gen-prompt">Prompt</Label>
                    <Textarea
                      id="gen-prompt"
                      value={genPrompt}
                      onChange={(e) => setGenPrompt(e.target.value)}
                      rows={5}
                      placeholder="A SaaS landing page with dark mode, pricing section and a contact form…"
                    />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={includeBackend} onChange={(e) => setIncludeBackend(e.target.checked)} />
                      Include backend
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={includeDb} onChange={(e) => setIncludeDb(e.target.checked)} />
                      Include database
                    </label>
                  </div>
                  <Button className="w-full" onClick={startGenerate} disabled={generating}>
                    {generating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate site
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-full w-[360px] shrink-0">
          <VibePanel projectId={projectId} onApply={(res) => applyContent(res.html, res.css, res.js)} />
        </div>
      </div>

      <Dialog open={genOpen} onOpenChange={(open) => { if (!generating) setGenOpen(open); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{version ? 'Regenerate site' : 'Generate site'}</DialogTitle>
            <DialogDescription>
              This creates a new version from the latest project context. Your previous versions stay
              safe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gen-prompt-dlg">Prompt</Label>
              <Textarea
                id="gen-prompt-dlg"
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                rows={5}
                placeholder="A SaaS landing page with dark mode, pricing section and a contact form…"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeBackend} onChange={(e) => setIncludeBackend(e.target.checked)} />
                Include backend
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeDb} onChange={(e) => setIncludeDb(e.target.checked)} />
                Include database
              </label>
            </div>
            {(generating || genLog.length > 0) && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {generating && (
                  <p className="flex items-center gap-2 text-violet-300">
                    <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                  </p>
                )}
                {genLog.map((line, i) => (
                  <p key={i} className="text-muted-foreground">{line}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            {generating ? (
              <Button variant="secondary" onClick={stopGenerate}>Stop</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setGenOpen(false)}>Close</Button>
                <Button onClick={startGenerate} disabled={!genPrompt.trim()}>
                  <Sparkles className="mr-2 h-4 w-4" /> Generate
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy your site</DialogTitle>
            <DialogDescription>
              Publish the latest version to your own subdomain on the HydraWeb platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center gap-2">
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="myapp"
                className="font-mono"
              />
              <span className="text-sm text-muted-foreground">.myplatform.dev</span>
            </div>
          </div>
          {liveUrl && (
            <div className="rounded-lg border bg-emerald-500/10 p-3 text-sm">
              Currently live at{' '}
              <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-400 hover:underline">
                <Globe className="h-3.5 w-3.5" /> {liveUrl}
              </a>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployOpen(false)}>Cancel</Button>
            <Button onClick={deploy} disabled={deploying}>
              {deploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
