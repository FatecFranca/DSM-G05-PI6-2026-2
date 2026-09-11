import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { apiUrl, getUser } from '@/lib/server-auth';
export const metadata = { title: 'Entrar | Estoque Inteligente' };
export default async function LoginPage() {
  if (await getUser()) redirect('/');
  let registrationEnabled = false;
  try {
    const response = await fetch(`${apiUrl}/api/v1/auth/config`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) registrationEnabled = (await response.json()).registrationEnabled;
  } catch { /* Login permanece acessível durante indisponibilidade temporária. */ }
  return <AuthForm mode="login" registrationEnabled={registrationEnabled} />;
}
