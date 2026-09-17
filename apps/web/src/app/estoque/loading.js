import { Skeleton } from '@/components/ui/skeleton';

export default function StockLoading() {
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8" aria-label="Carregando estoque">
    <Skeleton className="h-9 w-32" /><Skeleton className="h-20 w-full" /><div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div><Skeleton className="h-80 w-full" />
  </main>;
}
