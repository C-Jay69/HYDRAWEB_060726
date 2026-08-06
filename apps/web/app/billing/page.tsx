'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { clientAPI, clientUser } from '@/lib/client';
import { formatCents, formatDate } from '@/lib/utils';
import type { Invoice, Plan, Subscription, User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await clientUser();
      if (!u) {
        router.replace('/login');
        return;
      }
      setUser(u);
      const [p, s, i] = await Promise.all([
        clientAPI<Plan[]>('/billing/plans'),
        clientAPI<Subscription>('/billing/subscription'),
        clientAPI<Invoice[]>('/billing/invoices'),
      ]);
      if (p.ok && Array.isArray(p.data)) setPlans(p.data);
      if (s.ok && s.data) setSub(s.data as Subscription);
      if (i.ok && Array.isArray(i.data)) setInvoices(i.data);
      setLoading(false);
    })();
  }, [router]);

  async function checkout(tier: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle: 'monthly' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Checkout failed');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function portal() {
    setBusy(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Could not open billing portal');
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your plan, invoices and payment method.</p>
        </div>
        {sub && sub.plan_tier !== 'free' && (
          <Button variant="outline" onClick={portal} disabled={busy}>
            <ExternalLink className="mr-2 h-4 w-4" /> Stripe customer portal
          </Button>
        )}
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your plan</h2>
          <Badge variant="outline" className="capitalize">{sub?.plan_tier || 'free'}</Badge>
          {sub?.current_period_end && (
            <span className="text-xs text-muted-foreground">
              renews {formatDate(sub.current_period_end)}
            </span>
          )}
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = sub?.plan_tier === plan.tier;
            const isFree = plan.tier === 'free';
            return (
              <div
                key={plan.tier}
                className={`rounded-2xl border bg-card p-6 ${
                  isCurrent ? 'border-violet-500/60 ring-1 ring-violet-500/30' : ''
                }`}
              >
                <h3 className="text-lg font-semibold capitalize">{plan.name}</h3>
                <p className="mt-1 text-2xl font-bold">{plan.price_monthly}</p>
                <p className="text-xs text-muted-foreground">{plan.project_limit} project limit</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current plan
                    </Button>
                  ) : isFree ? (
                    <Button variant="outline" className="w-full" disabled>
                      Always free
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => checkout(plan.tier)} disabled={busy}>
                      Upgrade to {plan.name}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {sub && sub.plan_tier !== 'free' && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Button variant="ghost" onClick={portal} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Change cycle / cancel
            </Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No invoices yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="px-4 py-3">{formatDate(new Date(inv.created * 1000).toISOString())}</td>
                    <td className="px-4 py-3">{formatCents(inv.amount_due, inv.currency)}</td>
                    <td className="px-4 py-3 capitalize">{inv.status}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.url ? (
                        <a href={inv.url} target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">
                          PDF
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
