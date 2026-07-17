'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Landing page for the password-recovery email link. Supabase's browser client
 * exchanges the token in the URL for a session automatically; once a session
 * exists the user can set a new password.
 */
export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [noSession, setNoSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        done = true;
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) {
        done = true;
        setReady(true);
      }
    });

    const timer = setTimeout(() => {
      if (!done) setNoSession(true);
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  const inputCls =
    'mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Set a new password</h1>
        {!ready && !noSession && (
          <p className="mt-2 text-sm text-slate-500">Verifying your reset link…</p>
        )}
        {noSession && !ready && (
          <p className="mt-2 text-sm text-red-600">
            This reset link is invalid or expired (or was opened in a different browser than the
            one that requested it). Go back to the login page and request a new link from this
            browser.
          </p>
        )}
        {ready && (
          <form onSubmit={submit}>
            <p className="mt-1 text-sm text-slate-500">
              This password also signs you into the Montierra portal.
            </p>
            <input
              type="password"
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className={inputCls}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className={inputCls}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || password.length < 6 || !confirm}
              className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save password and continue'}
            </button>
            {password.length > 0 && password.length < 6 && (
              <p className="mt-2 text-xs text-slate-400">At least 6 characters.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
