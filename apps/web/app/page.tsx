'use client';

import { useState } from 'react';
import { ArrowRight, GitBranch, Globe, Rocket, Sparkles, Users, Workflow, Zap } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI generation',
    desc: 'Type a prompt. Get a full website with styled HTML/CSS, browser JS, a FastAPI backend, and a Postgres schema — no placeholders.',
  },
  {
    icon: Workflow,
    title: 'Vibe coding',
    desc: 'Keep iterating: "add a dark mode toggle". The AI proposes a patch; you review it and hit apply.',
  },
  {
    icon: Globe,
    title: 'One-click deploy',
    desc: 'Go live instantly on your own subdomain (myapp.myplatform.dev) with HTTPS and env-var management.',
  },
  {
    icon: Users,
    title: 'Team workspaces',
    desc: 'Invite owners, editors and viewers to collaborate on the same projects.',
  },
  {
    icon: GitBranch,
    title: 'Versions & rollback',
    desc: 'Every generation and applied suggestion is saved. Diff and roll back to any point.',
  },
  {
    icon: Zap,
    title: 'Stripe billing',
    desc: 'Free, Pro and Enterprise plans with subscriptions, invoices and a self-serve billing portal.',
  },
];

const EXAMPLES = [
  'A job board with user auth and Stripe payments',
  'A SaaS landing page with dark mode and pricing',
  'A portfolio for a designer with a contact form',
];

export default function Home() {
  const [prompt, setPrompt] = useState('');

  const startUrl = prompt.trim()
    ? `/signup?prompt=${encodeURIComponent(prompt.trim())}`
    : '/signup';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link className="hover:text-foreground" href="/#features">Features</Link>
            <Link className="hover:text-foreground" href="/#how">How it works</Link>
            <Link className="hover:text-foreground" href="/pricing">Pricing</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign up free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-4xl px-4 pb-24 pt-28 text-center">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
          <Badge className="mb-6 bg-violet-500/10 text-violet-300">AI website generator + vibe coding</Badge>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Describe it.{' '}
            <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
              Build it.
            </span>{' '}
            Deploy it.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            HydraWeb turns natural language into production-ready websites — frontend, backend and
            database — then lets you and your team keep refining them with AI until they&apos;re perfect.
          </p>

          <div className="mx-auto mt-10 max-w-2xl">
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-lg sm:flex-row sm:items-center">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (window.location.href = startUrl)}
                placeholder="Build me a React e-commerce site with Stripe checkout and a PostgreSQL database…"
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <Link href={startUrl}>
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Sparkles className="h-4 w-4" />
                  Start building
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-violet-500/50 hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">Everything you need to ship</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-card p-6 transition-colors hover:border-violet-500/40">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">From prompt to production</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              ['1', 'Describe', 'Type what you want to build in plain English.'],
              ['2', 'Generate', 'Get a full site with frontend, backend and DB schema.'],
              ['3', 'Refine', 'Chat with AI to tweak logic, styling and features.'],
              ['4', 'Deploy', 'Go live on your subdomain. Manage billing, versions and teams.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="relative rounded-2xl border bg-card p-6">
                <div className="mb-3 text-3xl font-black text-violet-400/80">{n}</div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <div className="rounded-3xl border bg-gradient-to-b from-violet-500/10 to-transparent p-12">
            <Rocket className="mx-auto mb-4 h-8 w-8 text-violet-400" />
            <h2 className="text-3xl font-bold tracking-tight">Free to start. No credit card required.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Create your first project for free, then upgrade to Pro when you need more room.
            </p>
            <Link href="/signup">
              <Button size="lg" className="mt-8 gap-2">
                Create your account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <p>© 2026 HydraWeb. Built with AI.</p>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
