import { Skeleton } from '@/components/ui/skeleton';
export default function Loading() {
  return <main className="mx-auto max-w-6xl space-y-5 p-6" aria-label="Carregando catálogo">
    <Skeleton className="h-12 w-64" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" />
  </main>;
}
