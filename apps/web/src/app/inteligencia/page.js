import { requireUser } from '@/lib/server-auth';
import { IntelligencePage } from '@/components/analysis-pages';
export const metadata = { title: 'Inteligência | Estoque Inteligente' };
export default async function Page() { await requireUser(); return <IntelligencePage />; }
