import { z } from 'zod';

// Valores decimais atravessam API e PostgreSQL como texto, sem arredondamento binário.
const decimal = z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/, 'Use um valor positivo com até quatro casas decimais.');
export const productInputSchema = z.object({
  sku: z.string().trim().toUpperCase().min(1).max(60).regex(/^[A-Z0-9._/-]+$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).default(''),
  unit: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/).default('UN'),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('BRL'),
  costPrice: decimal.default('0'),
  salePrice: decimal.default('0'),
  minimumStock: decimal.default('0'),
  leadTimeDays: z.number().int().min(0).max(3650).default(0),
  active: z.boolean().default(true),
}).strict();
export type ProductInput = z.infer<typeof productInputSchema>;
export type CatalogProduct = ProductInput & { id: string; version: number; source: string; updatedAt: string };
export type CatalogFilter = { search: string; status: 'all' | 'active' | 'inactive'; page: number; pageSize: number };
export interface ProductRepository {
  list(filter: CatalogFilter): Promise<{ data: CatalogProduct[]; total: number }>;
  createMany(products: ProductInput[], source: 'manual' | 'csv', actorId: string): Promise<CatalogProduct[]>;
  update(id: string, version: number, product: ProductInput, actorId: string): Promise<CatalogProduct>;
}
export interface ProductSource { read(content: string): ProductInput[] }
export class ProductError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
