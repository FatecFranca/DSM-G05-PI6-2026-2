import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';

import { InventoryService } from './application/inventory-service.js';
import { getConfig } from './config.js';
import type { InventoryRepository } from './domain/inventory-repository.js';
import { PostgresDatabase } from './infrastructure/database/postgres-database.js';
import { PostgresInventoryRepository } from './infrastructure/repositories/postgres-inventory-repository.js';
import { registerRoutes } from './presentation/routes.js';

type BuildAppOptions = {
  env?: NodeJS.ProcessEnv;
  logger?: boolean;
  repository?: InventoryRepository;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const config = getConfig(options.env);
  const app = Fastify({ logger: options.logger ?? config.nodeEnv !== 'test' });

  let database: PostgresDatabase | undefined;
  const repository = options.repository ?? (() => {
    database = new PostgresDatabase(config.databaseUrl, config.databasePoolMax);
    return new PostgresInventoryRepository(database);
  })();
  const service = new InventoryService(repository);

  if (database) {
    app.addHook('onClose', async () => database?.close());
  }

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.corsOrigins });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Estoque Inteligente API',
        description: 'API para gestão de estoque, classificação e previsão de demanda.',
        version: '0.2.0',
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
  await registerRoutes(app, service);

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `A rota ${request.method} ${request.url} não existe.`,
      statusCode: 404,
    });
  });

  return app;
}
