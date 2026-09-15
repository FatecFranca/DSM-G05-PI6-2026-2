import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProductService } from '../application/product-service.js';

export async function registerProductRoutes(app: FastifyInstance, service: ProductService) {
  // Catálogo separado da projeção de risco GET /products, preservando os clientes existentes.
  app.get('/api/v1/catalog/products', async (request) => {
    const filter = z.object({ search: z.string().trim().max(100).default(''), status: z.enum(['all', 'active', 'inactive']).default('all'),
      page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict().parse(request.query);
    return { ...await service.list(filter), page: filter.page, pageSize: filter.pageSize };
  });
  app.post('/api/v1/catalog/products', async (request, reply) => reply.code(201).send({ product: await service.create(request.body, request.user!) }));
  app.put('/api/v1/catalog/products/:id', async (request) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const { version, product } = z.object({ version: z.number().int().positive(), product: z.unknown() }).strict().parse(request.body);
    return { product: await service.update(id, version, product, request.user!) };
  });
  app.post('/api/v1/catalog/import', { bodyLimit: 128000, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request) => {
    const body = z.object({ csv: z.string().min(1).max(100000), preview: z.boolean().default(true) }).strict().parse(request.body);
    const data = await service.importCsv(body.csv, request.user!, body.preview);
    return { data, total: data.length, preview: body.preview };
  });
}
