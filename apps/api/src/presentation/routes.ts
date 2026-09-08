import type { FastifyInstance } from 'fastify';

import type { InventoryService } from '../application/inventory-service.js';
import type { RiskLevel } from '../domain/models.js';

type ProductQuery = {
  search?: string;
  risk?: RiskLevel;
};

type ForecastQuery = {
  horizon?: 7 | 30 | 90;
  productId?: string;
};

const successResponse = {
  200: { type: 'object', additionalProperties: true },
};

export async function registerRoutes(
  app: FastifyInstance,
  service: InventoryService,
) {
  app.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Verifica a API e a conexão com o banco',
      response: successResponse,
    },
  }, async () => ({
    status: 'ok',
    service: 'estoque-inteligente-api',
    database: (await service.healthCheck()) ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/v1/dashboard/summary', {
    schema: {
      tags: ['Dashboard'],
      summary: 'Consulta indicadores consolidados',
      response: successResponse,
    },
  }, () => service.getDashboardSummary());

  app.get<{ Querystring: ProductQuery }>('/api/v1/products', {
    schema: {
      tags: ['Products'],
      summary: 'Lista produtos, estoque e risco',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 120 },
          risk: {
            type: 'string',
            enum: ['critical', 'attention', 'healthy'],
          },
        },
      },
      response: successResponse,
    },
  }, (request) => service.listProducts(request.query));

  app.get<{ Querystring: ForecastQuery }>('/api/v1/forecasts', {
    schema: {
      tags: ['Forecasts'],
      summary: 'Consulta histórico e previsão',
      querystring: {
        type: 'object',
        properties: {
          horizon: { type: 'integer', enum: [7, 30, 90], default: 7 },
          productId: { type: 'string', format: 'uuid' },
        },
      },
      response: successResponse,
    },
  }, (request) => service.getForecast(
    request.query.horizon ?? 7,
    request.query.productId,
  ));

  app.get('/api/v1/sync-runs', {
    schema: {
      tags: ['Integrations'],
      summary: 'Lista sincronizações recentes',
      response: successResponse,
    },
  }, () => service.listSyncRuns());
}
