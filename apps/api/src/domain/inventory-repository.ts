import type {
  DashboardSummary,
  DatasetStatus,
  ForecastResult,
  ProductFilters,
  ProductList,
  ProductInsightsResult,
  SyncRunList,
} from './models.js';

export interface InventoryRepository {
  healthCheck(): Promise<boolean>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listProducts(filters: ProductFilters): Promise<ProductList>;
  getForecast(horizon: 7 | 30 | 90, productId?: string): Promise<ForecastResult>;
  getProductInsights(horizon: 7 | 30 | 90): Promise<ProductInsightsResult>;
  listSyncRuns(): Promise<SyncRunList>;
  getCurrentDataset(): Promise<DatasetStatus | null>;
}
