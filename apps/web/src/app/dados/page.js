import { requireUser } from '@/lib/server-auth';
import { DataQualityPage } from '@/components/analysis-pages';
export const metadata = { title: 'Qualidade dos dados | Estoque Inteligente' };
export default async function Page() { await requireUser(); return <DataQualityPage />; }
