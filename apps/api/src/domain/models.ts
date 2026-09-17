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
    demo: false;
    generatedAt: string;
    lastSyncAt: string | null;
    dataset: string | null;
    datasetPeriodEnd: string | null;
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
  demo: false;
  productId: string | null;
  horizon: 7 | 30 | 90;
  model: string | null;
  generatedAt: string | null;
  data: DemandPoint[];
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
