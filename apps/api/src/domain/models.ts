export type RiskLevel = 'critical' | 'attention' | 'healthy';

export type DemandPoint = {
  label: string;
  date: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
};

export type ClassificationSummary = {
  name: string;
  products: number;
  percent: number;
  revenue: number;
  color: string;
};

export type ProductSummary = {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  forecast: number;
  coverage: number;
  classification: string;
  risk: RiskLevel;
  severity: 'Crítico' | 'Atenção' | 'Saudável';
};

export type DashboardSummary = {
  meta: {
    source: 'postgresql';
    demo: boolean;
    generatedAt: string;
    lastSyncAt: string | null;
    dataset: string | null;
    datasetPeriodEnd: string | null;
    forecastStartsOn: string | null;
    dataStale: boolean;
  };
  kpis: {
    stockValue: number;
    stockValueCurrency: string;
    activeProducts: number;
    stockoutRisk: number;
    serviceLevel: number;
  };
  demandSeries: DemandPoint[];
  classifications: ClassificationSummary[];
  riskProducts: ProductSummary[];
};

export type ProductFilters = {
  search?: string;
  risk?: RiskLevel;
};

export type ProductList = {
  data: ProductSummary[];
  total: number;
  demo: false;
};

export type ForecastResult = {
  demo: boolean;
  metrics?: Record<string, unknown>;
  productId: string | null;
  horizon: 7 | 30 | 90;
  model: string | null;
  generatedAt: string | null;
  asOfDate: string;
  dataThrough: string | null;
  forecastStartsOn: string | null;
  stale: boolean;
  data: DemandPoint[];
};

export type ProductInsight = {
  id: string;
  sku: string;
  name: string;
  currentClass: 'A' | 'B' | 'C' | null;
  projectedClass: 'A' | 'B' | 'C';
  classChange: 'up' | 'down' | 'stable' | 'new';
  trend: 'rising' | 'falling' | 'stable';
  trendPercent: number;
  recentDailyAverage: number;
  forecastDailyAverage: number;
  availableStock: number;
  minimumStock: number;
  leadTimeDays: number;
  reorderPoint: number;
  suggestedReorderQuantity: number;
  needsReorder: boolean;
};

export type ProductInsightsResult = {
  meta: {
    horizon: 7 | 30 | 90;
    asOfDate: string;
    dataThrough: string | null;
    forecastStartsOn: string | null;
    model: string | null;
    stale: boolean;
    methodology: string;
  };
  data: ProductInsight[];
  total: number;
};

export type SyncRun = {
  id: string;
  source: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  recordsProcessed: number;
};

export type SyncRunList = { data: SyncRun[]; total: number; demo: false };

export type DatasetStatus = {
  isSimulated?: boolean;
  currency?: string;
  name: string;
  version: string;
  status: string;
  sourceUrl: string;
  doi: string;
  license: string;
  fileSha256: string;
  recordsRead: number;
  recordsAccepted: number;
  recordsRejected: number;
  periodStartedOn: string | null;
  periodEndedOn: string | null;
  importedAt: string | null;
  qualitySummary: Record<string, unknown>;
};
