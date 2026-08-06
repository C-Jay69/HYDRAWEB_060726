'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Logo } from '@/components/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clientAPI } from '@/lib/client';
import type { Plan } from '@/lib/types';

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await clientAPI<Plan[]>('/billing/plans');
      if (res.ok && Array.isArray(res.data)) setPlans(res.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
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

      <main className="mx-auto max-w-5xl px-4 py-20">
        <div className="text-center">
          <Badge className="mb-4 bg-violet-500/10 text-violet-300">Simple pricing</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Pick a plan that grows with you</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start free. Upgrade when you need more projects, higher rate limits and priority model access.
          </p>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-2xl border bg-card p-8 ${
                  plan.tier === 'pro' ? 'border-violet-500/60 ring-1 ring-violet-500/30' : ''
                }`}
              >
                {plan.tier === 'pro' && (
                  <Badge className="mb-4 bg-violet-500/15 text-violet-300">Most popular</Badge>
                )}
                <h3 className="text-lg font-semibold capitalize">{plan.name}</h3>
                <p className="mt-2 text-4xl font-bold">{plan.price_monthly}</p>
                <p className="mt-1 text-xs text-muted-foreground">per month, billed monthly</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-8 block">
                  <Button className="w-full" variant={plan.tier === 'free' ? 'outline' : 'default'}>
                    {plan.tier === 'free' ? 'Start for free' : 'Get ' + plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <p>© 2026 HydraWeb. Payments handled securely by Stripe.</p>
        </div>
      </footer>
    </div>
  );
}
