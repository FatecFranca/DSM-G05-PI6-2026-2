import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { apiUrl, getUser } from '@/lib/server-auth';
export const metadata = { title: 'Criar conta | Estoque Inteligente' };
export default async function RegisterPage() {
  if (await getUser()) redirect('/');
  const response = await fetch(`${apiUrl}/api/v1/auth/config`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Não foi possível consultar a disponibilidade do cadastro.');
  if (!(await response.json()).registrationEnabled) return <div className="auth-card"><h2>Cadastro fechado</h2><p>Entre em contato com o responsável pelo sistema.</p><Link href="/login">Voltar ao login</Link></div>;
  return <AuthForm mode="register" />;
}
