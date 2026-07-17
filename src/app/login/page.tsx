'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const router = useRouter();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(
      'Check your email for a reset link. Open it in this browser, then choose a new password.',
    );
  };

  const inputCls =
    'mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={mode === 'signin' ? signIn : sendReset}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-lg font-bold text-slate-900">Montierra Development Models</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'signin'
            ? 'Sign in with your Montierra portal email and password.'
            : 'Enter your email and we’ll send a password reset link.'}
        </p>
        <input
          type="email"
          autoFocus
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputCls}
        />
        {mode === 'signin' && (
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className={inputCls}
          />
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {info && <p className="mt-2 text-sm text-emerald-700">{info}</p>}
        <button
          type="submit"
          disabled={busy || !email || (mode === 'signin' && !password)}
          className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
        </button>
        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            type="button"
            className="text-slate-500 underline hover:text-slate-800"
            onClick={() => {
              setMode(mode === 'signin' ? 'forgot' : 'signin');
              setError(null);
              setInfo(null);
            }}
          >
            {mode === 'signin' ? 'Forgot password?' : '← Back to sign in'}
          </button>
          <span className="text-slate-400">Approved partner accounts only</span>
        </div>
        {mode === 'forgot' && (
          <p className="mt-3 text-xs text-amber-700">
            Note: this password is shared with the Montierra portal — resetting it here changes it
            there too.
          </p>
        )}
      </form>
    </div>
  );
}
