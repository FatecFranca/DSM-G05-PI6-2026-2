import Link from 'next/link';
import { AuthForm } from '@/components/auth/auth-form';
import { requireUser } from '@/lib/server-auth';
export const metadata = { title: 'Minha conta | Estoque Inteligente' };
export default async function AccountPage() {
  const user = await requireUser();
  return <main className="account-page motion-enter"><Link href="/">← Voltar ao painel</Link><header><h1>Minha conta</h1><p>{user.name} · {user.email}</p></header><AuthForm mode="change" /></main>;
}
