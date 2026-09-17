import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { StockService } from '../application/stock-service.js';

const page = z.coerce.number().int().min(1).max(100000).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);

export async function registerStockRoutes(app: FastifyInstance, service: StockService) {
  app.get('/api/v1/inventory/options', () => service.options());
  app.get('/api/v1/inventory/levels', async (request) => {
    const filter = z.object({ search: z.string().trim().max(100).default(''), warehouseId: z.uuid().optional(), page, pageSize }).strict().parse(request.query);
    return { ...await service.levels(filter), page: filter.page, pageSize: filter.pageSize };
  });
  app.get('/api/v1/inventory/movements', async (request) => {
    const filter = z.object({ productId: z.uuid().optional(), warehouseId: z.uuid().optional(),
      type: z.enum(['entry', 'exit', 'adjustment', 'transfer_in', 'transfer_out']).optional(), page, pageSize }).strict().parse(request.query);
    return { ...await service.movements(filter), page: filter.page, pageSize: filter.pageSize };
  });
  app.post('/api/v1/inventory/movements', async (request, reply) => reply.code(201).send(await service.apply(request.body, request.user!)));
  app.post('/api/v1/inventory/transfers', async (request, reply) => reply.code(201).send(await service.transfer(request.body, request.user!)));
  app.post('/api/v1/inventory/warehouses', async (request, reply) => reply.code(201).send({ warehouse: await service.createWarehouse(request.body, request.user!) }));
}
