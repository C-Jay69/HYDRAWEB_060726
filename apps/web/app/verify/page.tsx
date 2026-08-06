'use client';

import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

function Verify() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function run() {
      if (!token) {
        setState('error');
        setMessage('Missing verification token.');
        return;
      }
      try {
        const res = await fetch(`/api/verify/${token}`);
        const data = await res.json();
        if (!res.ok) {
          setState('error');
          setMessage(data.detail || 'Verification failed.');
        } else {
          setState('ok');
          setMessage('Email verified — you can now log in.');
        }
      } catch {
        setState('error');
        setMessage('Network error — is the backend running?');
      }
    }
    void run();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-lg">
          {state === 'loading' && (
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-400" />
          )}
          {state === 'ok' && (
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          )}
          {state === 'error' && (
            <XCircle className="mx-auto h-10 w-10 text-red-400" />
          )}
          <h1 className="mt-4 text-lg font-bold">
            {state === 'ok' ? 'Email verified' : state === 'error' ? 'Verification failed' : 'Verifying…'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Link href="/login" className="mt-6 block">
            <Button className="w-full">Go to login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
