import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const apiUrl = process.env.API_URL ?? 'http://127.0.0.1:3333';

export async function getUser() {
  const session = (await cookies()).get('estoque_session');
  if (!session) return null;
  const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
    headers: { Cookie: `estoque_session=${encodeURIComponent(session.value)}` },
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('O serviço de autenticação está indisponível.');
  return (await response.json()).user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}
