import type { InventoryRepository } from '../domain/inventory-repository.js';
import type { ProductFilters } from '../domain/models.js';

export class InventoryService {
  public constructor(private readonly repository: InventoryRepository) {}

  public healthCheck() {
    return this.repository.healthCheck();
  }

  public getDashboardSummary() {
    return this.repository.getDashboardSummary();
  }

  public listProducts(filters: ProductFilters) {
    return this.repository.listProducts(filters);
  }

  public getForecast(horizon: 7 | 30 | 90, productId?: string) {
    return this.repository.getForecast(horizon, productId);
  }

  public listSyncRuns() {
    return this.repository.listSyncRuns();
  }
}
