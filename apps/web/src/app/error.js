'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }) {
  return <main className="account-page"><h1>Não foi possível carregar esta página.</h1><p>O serviço pode estar temporariamente indisponível. Tente novamente em instantes.</p><Button onClick={reset}>Tentar novamente</Button></main>;
}
