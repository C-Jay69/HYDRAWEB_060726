'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { clientAPI, clientUser } from '@/lib/client';
import { formatDate } from '@/lib/utils';
import type { ApiKey, User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await clientUser();
      if (!u) {
        router.replace('/login');
        return;
      }
      setUser(u);
      setName(u.name);
      setBio(u.bio || '');
      const res = await clientAPI<ApiKey[]>('/users/api-keys');
      if (res.ok && Array.isArray(res.data)) setApiKeys(res.data);
    })();
  }, [router]);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), bio }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Failed to save profile');
        return;
      }
      toast.success('Profile updated');
      setUser((prev) => (prev ? { ...prev, name: data.name, bio: data.bio } : prev));
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      toast.error('Give the key a name');
      return;
    }
    setCreatingKey(true);
    try {
      const res = await fetch('/api/users/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Failed to create key');
        return;
      }
      toast.success('API key created — copy it now, it won\'t be shown again.');
      await navigator.clipboard.writeText(data.key);
      setNewKeyName('');
      const list = await clientAPI<ApiKey[]>('/users/api-keys');
      if (list.ok) setApiKeys(list.data);
    } catch {
      toast.error('Network error');
    } finally {
      setCreatingKey(false);
    }
  }

  async function deleteKey(id: string) {
    try {
      const res = await fetch(`/api/users/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        toast.error('Failed to delete key');
        return;
      }
      toast.success('API key revoked');
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      toast.error('Network error');
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Profile, API access and account details.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-name">Name</Label>
              <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-email">Email</Label>
              <Input id="set-email" value={user.email} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-bio">Bio</Label>
              <Textarea
                id="set-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="A short bio shown on your public profile."
              />
            </div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <KeyRound className="h-4 w-4" /> API keys
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use these keys to call the HydraWeb API programmatically (Authorization: Bearer hw_…).
          </p>
          <div className="mt-5 flex gap-2">
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. CI pipeline)"
            />
            <Button onClick={createKey} disabled={creatingKey}>
              {creatingKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </div>
          <div className="mt-5 space-y-2">
            {apiKeys.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No API keys yet.
              </p>
            )}
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{key.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.prefix}… · {key.last_used_at ? `last used ${formatDate(key.last_used_at)}` : 'never used'}
                  </p>
                </div>
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Copy prefix"
                    onClick={() => navigator.clipboard.writeText(key.prefix)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-400"
                    title="Revoke"
                    onClick={() => deleteKey(key.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
