import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';
import { hashToken } from '../src/infrastructure/security/password-hasher.js';
import type { InventoryRepository } from '../src/domain/inventory-repository.js';
import type {
  DashboardSummary,
  ForecastResult,
  ProductFilters,
  ProductList,
  SyncRunList,
} from '../src/domain/models.js';

const product = {
  id: '20000000-0000-4000-8000-000000000001',
  sku: 'CAF-500-TD',
  name: 'Café Torrado 500 g',
  category: 'Mercearia',
  stock: 14,
  forecast: 213,
  coverage: 2,
  classification: 'AX',
  risk: 'critical' as const,
  severity: 'Crítico' as const,
};

class FakeInventoryRepository implements InventoryRepository {
  public async healthCheck() {
    return true;
  }

  public async getDashboardSummary(): Promise<DashboardSummary> {
    return {
      meta: {
        source: 'postgresql',
        demo: false,
        generatedAt: new Date().toISOString(),
        lastSyncAt: null,
      },
      kpis: {
        stockValue: 184_320,
        activeProducts: 1,
        stockoutRisk: 1,
        serviceLevel: 94.2,
      },
      demandSeries: [],
      classifications: [],
      riskProducts: [product],
    };
  }

  public async listProducts(filters: ProductFilters): Promise<ProductList> {
    const matches = !filters.search
      || product.name.toLocaleLowerCase('pt-BR').includes(
        filters.search.toLocaleLowerCase('pt-BR'),
      );
    const data = matches && (!filters.risk || filters.risk === product.risk)
      ? [product]
      : [];
    return { data, total: data.length, demo: false };
  }

  public async getForecast(
    horizon: 7 | 30 | 90,
    productId?: string,
  ): Promise<ForecastResult> {
    return {
      demo: false,
      productId: productId ?? null,
      horizon,
      model: 'test-v1',
      generatedAt: null,
      data: [],
    };
  }

  public async listSyncRuns(): Promise<SyncRunList> {
    return { data: [], total: 0, demo: false };
  }
}

describe('Estoque Inteligente API', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp({
      logger: false,
      repository: new FakeInventoryRepository(),
      authRepository: {
        async findSession(hash) { return hash === hashToken('a'.repeat(43)) ? { id: 'test', name: 'Teste', email: 'test@example.com', role: 'viewer' } : null; },
        async createUser() { throw new Error('Não utilizado'); },
        async findByEmail() { throw new Error('Não utilizado'); },
        async createSession() { throw new Error('Não utilizado'); },
        async revokeSession() { throw new Error('Não utilizado'); },
        async createReset() { throw new Error('Não utilizado'); },
        async resetPassword() { throw new Error('Não utilizado'); },
        async changePassword() { throw new Error('Não utilizado'); },
        async consumeLimit() { throw new Error('Não utilizado'); },
      },
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      },
    });
  });

  after(async () => app.close());

  it('responde ao health check com o banco conectado', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().database, 'connected');
  });

  it('retorna o resumo do dashboard vindo do repositório', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/summary',
      headers: { cookie: `estoque_session=${'a'.repeat(43)}` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.demo, false);
    assert.equal(response.json().kpis.activeProducts, 1);
  });

  it('filtra produtos por texto e risco', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/products?search=caf%C3%A9&risk=critical',
      headers: { cookie: `estoque_session=${'a'.repeat(43)}` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].sku, 'CAF-500-TD');
  });

  it('rejeita horizonte inválido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/forecasts?horizon=14',
      headers: { cookie: `estoque_session=${'a'.repeat(43)}` },
    });
    assert.equal(response.statusCode, 400);
  });
});
