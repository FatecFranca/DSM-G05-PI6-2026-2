import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { getConfig } from './config.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { forecastRoutes } from './routes/forecasts.js';
import { productRoutes } from './routes/products.js';
import { syncRunRoutes } from './routes/sync-runs.js';

export async function buildApp(options = {}) {
  const config = getConfig(options.env);
  const logger = options.logger ?? {
    level: config.logLevel,
    ...(config.isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' },
          },
        }),
  };

  const app = Fastify({
    logger,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.corsOrigin.split(',').map((origin) => origin.trim()),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Estoque Inteligente API',
        description: 'Contrato inicial da API para gestão de estoque e previsão de demanda.',
        version: '0.1.0',
      },
      tags: [
        { name: 'System', description: 'Saúde da aplicação' },
        { name: 'Dashboard', description: 'Indicadores consolidados' },
        { name: 'Products', description: 'Catálogo e situação dos produtos' },
        { name: 'Forecasts', description: 'Previsões de demanda' },
        { name: 'Integrations', description: 'Sincronizações externas' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Verifica se a API está disponível',
        response: {
          200: {
            type: 'object',
            required: ['status', 'service', 'timestamp'],
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      service: 'estoque-inteligente-api',
      timestamp: new Date().toISOString(),
    }),
  );

  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
  await app.register(productRoutes, { prefix: '/api/v1/products' });
  await app.register(forecastRoutes, { prefix: '/api/v1/forecasts' });
  await app.register(syncRunRoutes, { prefix: '/api/v1/sync-runs' });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `A rota ${request.method} ${request.url} não existe.`,
      statusCode: 404,
    });
  });

  return app;
}
