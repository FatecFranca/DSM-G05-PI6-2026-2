import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { AuthService } from './application/auth-service.js';
import { AuthError, type AuthRepository, type ResetMailer } from './domain/auth.js';
import { PostgresAuthRepository } from './infrastructure/repositories/postgres-auth-repository.js';
import { ConfiguredResetMailer } from './infrastructure/mail/reset-mailer.js';
import { registerAuthRoutes } from './presentation/auth-routes.js';
import { ProductService } from './application/product-service.js';
import { ProductError } from './domain/product.js';
import { PostgresProductRepository } from './infrastructure/repositories/postgres-product-repository.js';
import { CsvProductSource } from './infrastructure/sources/csv-product-source.js';
import { registerProductRoutes } from './presentation/product-routes.js';
import { StockService } from './application/stock-service.js';
import { StockError } from './domain/stock.js';
import { PostgresStockRepository } from './infrastructure/repositories/postgres-stock-repository.js';
import { registerStockRoutes } from './presentation/stock-routes.js';

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
  authRepository?: AuthRepository;
  mailer?: ResetMailer;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const config = getConfig(options.env);
  const loggingEnabled = options.logger ?? config.nodeEnv !== 'test';
  const app = Fastify({ bodyLimit: 16384, logger: loggingEnabled ? {
    level: config.logLevel,
    redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  } : false });

  let database: PostgresDatabase | undefined;
  const repository = options.repository ?? (() => {
    database = new PostgresDatabase(config.databaseUrl, config.databasePoolMax);
    return new PostgresInventoryRepository(database);
  })();
  const service = new InventoryService(repository);
  if (!database) { database = new PostgresDatabase(config.databaseUrl, config.databasePoolMax); }
  const authService = new AuthService(options.authRepository ?? new PostgresAuthRepository(database!),
    options.mailer ?? new ConfiguredResetMailer(config), config.webUrl, config.registrationEnabled);

  if (database) {
    app.addHook('onClose', async () => database?.close());
  }

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(cors, { origin: [...new Set([config.webUrl, ...config.corsOrigins])], credentials: true,
    allowedHeaders: ['Content-Type', 'X-Requested-With'], methods: ['GET', 'POST', 'PUT', 'OPTIONS'] });
  await app.register(rateLimit, { global: true, max: 200, timeWindow: '1 minute' });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ message: 'Confira os campos informados.', fields: error.flatten().fieldErrors });
    }
    if (error instanceof AuthError || error instanceof ProductError || error instanceof StockError) {
      if (error.statusCode === 429) { reply.header('Retry-After', '900'); }
      return reply.code(error.statusCode).send({ message: error.message });
    }
    const status = typeof error === 'object' && error !== null && 'statusCode' in error
      && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 500) { request.log.error({ code: 'INTERNAL_ERROR', requestId: request.id }, 'Falha interna'); }
    return reply.code(status).send({ message: status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.'
      : status < 500 ? 'Solicitação inválida.' : 'Não foi possível concluir a solicitação. Tente novamente.' });
  });
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
        { name: 'Inventory', description: 'Saldos e movimentações de estoque' },
        { name: 'Forecasts', description: 'Previsões de demanda' },
        { name: 'Integrations', description: 'Sincronizações externas' },
        { name: 'Data', description: 'Proveniência e qualidade dos dados' },
      ],
    },
  });
  await registerAuthRoutes(app, authService, config);
  await app.register(swaggerUi, { routePrefix: '/docs' });
  await registerRoutes(app, service);
  await registerProductRoutes(app, new ProductService(new PostgresProductRepository(database), new CsvProductSource()));
  await registerStockRoutes(app, new StockService(new PostgresStockRepository(database)));

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: `A rota ${request.method} ${request.url} não existe.`,
      statusCode: 404,
    });
  });

  return app;
}
