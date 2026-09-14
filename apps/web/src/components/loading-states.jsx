import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function AuthSkeleton({ fields = 2 }) {
  return <Card className="auth-card" role="status" aria-label="Carregando formulário" aria-busy="true">
    <span className="sr-only">Carregando formulário…</span>
    <div className="form-skeleton" aria-hidden="true">
      <Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-4/5" /><Skeleton className="h-4 w-full" />
      {Array.from({ length: fields }, (_, index) => <div className="skeleton-field" key={index}><Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full" /></div>)}
      <Skeleton className="h-11 w-full" /><Skeleton className="mx-auto h-4 w-40" />
    </div>
  </Card>;
}

export function ChartSkeleton() {
  return <Card className="chart-card skeleton-panel" role="status" aria-label="Carregando previsão" aria-busy="true">
    <span className="sr-only">Carregando previsão para o período selecionado…</span>
    <Skeleton className="h-5 w-44" /><Skeleton className="h-4 w-64" /><Skeleton className="h-60 w-full" />
  </Card>;
}

export function DashboardSkeleton() {
  return <div className="dashboard-skeleton" role="status" aria-label="Carregando painel" aria-busy="true">
    <span className="sr-only">Carregando indicadores, gráficos e produtos…</span>
    <div aria-hidden="true" className="dashboard-skeleton-content">
      <div className="metrics-grid">{Array.from({ length: 4 }, (_, index) => <Card className="skeleton-panel" key={index}><Skeleton className="h-4 w-3/5" /><Skeleton className="h-9 w-2/5" /><Skeleton className="h-3 w-4/5" /></Card>)}</div>
      <div className="analytics-grid"><Card className="skeleton-panel"><Skeleton className="h-5 w-44" /><Skeleton className="h-60 w-full" /></Card><Card className="skeleton-panel"><Skeleton className="h-5 w-28" />{[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</Card></div>
      <Card className="skeleton-panel"><Skeleton className="h-5 w-60" />{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full" />)}</Card>
    </div>
  </div>;
}
