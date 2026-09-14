'use client';
import { useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthApiClient } from '@/services/auth-api-client';
export function AccountMenu() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setBusy(true); setError('');
    try {
      await new AuthApiClient().request('logout', {});
      window.location.replace('/login');
    } catch (failure) { setError(failure.message); setBusy(false); }
  }
  return <div className="account-actions"><Button asChild variant="ghost"><Link href="/conta"><UserRound />Minha conta</Link></Button><Button variant="outline" disabled={busy} aria-busy={busy} onClick={logout}>{busy ? <LoaderCircle className="animate-spin" /> : <LogOut />}{busy ? 'Saindo…' : 'Sair'}</Button>{error && <p role="alert">{error}</p>}</div>;
}
