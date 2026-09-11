import { DashboardSkeleton } from '@/components/loading-states';
export default function Loading() {
  return <main className="page-loading"><h1>Carregando seu espaço…</h1><DashboardSkeleton /></main>;
}
