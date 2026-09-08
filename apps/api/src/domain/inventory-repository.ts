import type {
  DashboardSummary,
  ForecastResult,
  ProductFilters,
  ProductList,
  SyncRunList,
} from './models.js';

export interface InventoryRepository {
  healthCheck(): Promise<boolean>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listProducts(filters: ProductFilters): Promise<ProductList>;
  getForecast(horizon: 7 | 30 | 90, productId?: string): Promise<ForecastResult>;
  listSyncRuns(): Promise<SyncRunList>;
}
