'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  FileCode2,
  KeyRound,
  Loader2,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
  XCircle,
  Boxes,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { clientAPI, clientUser } from '@/lib/client';
import { formatCents, formatDate } from '@/lib/utils';
import type {
  AdminPaymentRow,
  AdminProject,
  AdminStats,
  AdminSubscriptionRow,
  AdminUsageRow,
  AdminUser,
  User,
} from '@/lib/types';

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-card p-5 ${accent ? 'border-violet-500/50' : ''}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${accent ? 'text-violet-400' : ''}`} />
        {label}
      </div>
      <p className={`mt-2 text-2xl font-bold ${accent ? 'text-violet-200' : ''}`}>{value}</p>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [usage, setUsage] = useState<AdminUsageRow[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = await clientUser();
      if (!u || u.role !== 'admin') {
        toast.error('Admin access required');
        router.replace('/dashboard');
        return;
      }
      setUser(u);
      const results = await Promise.allSettled([
        clientAPI<AdminStats>('/admin/stats'),
        clientAPI<AdminUser[]>('/admin/users'),
        clientAPI<AdminProject[]>('/admin/projects'),
        clientAPI<AdminUsageRow[]>('/admin/usage'),
        clientAPI<AdminPaymentRow[]>('/admin/payments'),
        clientAPI<AdminSubscriptionRow[]>('/admin/subscriptions'),
      ]);
      const [s, us, p, ug, pa, su] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
      if (s?.ok && s.data) setStats(s.data as AdminStats);
      if (us?.ok && Array.isArray(us.data)) setUsers(us.data as AdminUser[]);
      if (p?.ok && Array.isArray(p.data)) setProjects(p.data as AdminProject[]);
      if (ug?.ok && Array.isArray(ug.data)) setUsage(ug.data as AdminUsageRow[]);
      if (pa?.ok && Array.isArray(pa.data)) setPayments(pa.data as AdminPaymentRow[]);
      if (su?.ok && Array.isArray(su.data)) setSubscriptions(su.data as AdminSubscriptionRow[]);
      setLoading(false);
    })();
  }, [router]);

  async function moderate(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await clientAPI<AdminUser>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error((res.data as { detail?: string })?.detail || 'Failed to update user');
        return;
      }
      const updated = res.data as AdminUser;
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      toast.success('User updated');
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(null);
    }
  }

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === 'active' && s.plan_tier !== 'free').length,
    [subscriptions],
  );

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  const tokens = stats?.llm_total_tokens ?? 0;

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Shield className="h-6 w-6 text-violet-400" /> Admin Portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintenance and analytics. Admins bypass all plan limits.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={UserRound} label="Users" value={String(stats?.users ?? 0)} />
        <StatCard icon={Boxes} label="Projects" value={String(stats?.projects ?? 0)} accent />
        <StatCard icon={ShieldCheck} label="Deployments" value={String(stats?.deployments ?? 0)} />
        <StatCard icon={KeyRound} label="API keys" value={String(stats?.api_keys ?? 0)} />
        <StatCard icon={Users} label="Teams" value={String(stats?.teams ?? 0)} />
        <StatCard icon={Cpu} label="LLM calls" value={String(stats?.llm_calls ?? 0)} />
        <StatCard icon={FileCode2} label="LLM tokens" value={tokens.toLocaleString()} />
        <StatCard icon={DollarSign} label="Revenue" value={formatCents(stats?.revenue_cents ?? 0)} accent />
        <StatCard icon={UserRound} label="Signups (7d)" value={String(stats?.signups_last_7_days ?? 0)} />
        <StatCard icon={Boxes} label="Projects (7d)" value={String(stats?.projects_last_7_days ?? 0)} />
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({activeSubs} paid)</TabsTrigger>
          <TabsTrigger value="usage">LLM usage</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <Badge variant="destructive">banned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-400">active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {u.role !== 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === u.id}
                            onClick={() => moderate(u.id, { role: 'admin' })}
                          >
                            <Shield className="mr-1.5 h-3.5 w-3.5" /> Make admin
                          </Button>
                        )}
                        {u.banned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === u.id}
                            onClick={() => moderate(u.id, { banned: false })}
                          >
                            Unban
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            disabled={busy === u.id || u.role === 'admin'}
                            onClick={() => moderate(u.id, { banned: true })}
                          >
                            <XCircle className="mr-1.5 h-3.5 w-3.5" /> Ban
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">/{p.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.owner_email}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3">v{p.latest_version}</td>
                    <td className="px-4 py-3 capitalize">{p.visibility}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cycle</th>
                  <th className="px-4 py-3 font-medium">Renews</th>
                  <th className="px-4 py-3 font-medium">Stripe ID</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{s.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.plan_tier === 'enterprise' ? 'default' : 'outline'} className="capitalize">
                        {s.plan_tier}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={s.status === 'active' ? 'outline' : 'destructive'} className="capitalize">
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 capitalize">{s.billing_cycle}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.current_period_end ? formatDate(s.current_period_end) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.stripe_subscription_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="usage">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Endpoint</th>
                  <th className="px-4 py-3 font-medium">Tokens</th>
                  <th className="px-4 py-3 font-medium">Est. cost</th>
                  <th className="px-4 py-3 font-medium">Cached</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">{row.email || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-3">{row.endpoint}</td>
                    <td className="px-4 py-3">{row.total_tokens.toLocaleString()}</td>
                    <td className="px-4 py-3">${row.cost_estimate.toFixed(4)}</td>
                    <td className="px-4 py-3">{row.cached ? 'yes' : 'no'}</td>
                  </tr>
                ))}
                {usage.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No LLM usage recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment intent</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">{p.email || '—'}</td>
                    <td className="px-4 py-3">{p.product_name}</td>
                    <td className="px-4 py-3 font-medium">{formatCents(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.stripe_payment_intent_id}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No one-time payments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <CreditCard className="h-3.5 w-3.5" />
        One-time revenue {formatCents(stats?.one_time_revenue_cents ?? 0)} · subscriptions are
        tracked via the Stripe webhook on the billing page.
      </p>
    </AppShell>
  );
}
