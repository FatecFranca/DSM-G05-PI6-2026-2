import type { PoolClient } from 'pg';
import { ProductError, type CatalogProduct, type CatalogFilter, type ProductInput, type ProductRepository } from '../../domain/product.js';
import type { PostgresDatabase } from '../database/postgres-database.js';

const columns = `id, sku, name, COALESCE(description,'') AS description, unit, active,
  COALESCE(cost_price,0)::text AS "costPrice", COALESCE(sale_price,0)::text AS "salePrice",
  COALESCE(minimum_stock,0)::text AS "minimumStock", COALESCE(lead_time_days,0) AS "leadTimeDays",
  source, version, updated_at::text AS "updatedAt"`;
const values = (p: ProductInput) => [p.sku, p.name, p.description, p.unit, p.costPrice, p.salePrice, p.minimumStock, p.leadTimeDays, p.active];

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly db: PostgresDatabase) {}
  async list(filter: CatalogFilter) {
    const where = `($1='' OR strpos(lower(name),lower($1))>0 OR strpos(lower(sku),lower($1))>0)
      AND ($2='all' OR active=($2='active'))`;
    const params = [filter.search, filter.status];
    const [data, count] = await Promise.all([
      this.db.query<CatalogProduct>(`SELECT ${columns} FROM products WHERE ${where} ORDER BY name,id LIMIT $3 OFFSET $4`, [...params, filter.pageSize, (filter.page - 1) * filter.pageSize]),
      this.db.query<{ total: number }>(`SELECT count(*)::int AS total FROM products WHERE ${where}`, params),
    ]);
    return { data: data.rows, total: count.rows[0]!.total };
  }
  private async event(client: PoolClient, product: CatalogProduct, actorId: string, event: string) {
    await client.query('INSERT INTO audit_logs(user_id,event) VALUES($1,$2)', [actorId, event]);
    await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,correlation_id,payload)
      VALUES('product',$1,$2,gen_random_uuid(),$3::jsonb)`, [product.id, event, JSON.stringify({ productId: product.id, version: product.version, source: product.source, actorId })]);
  }
  private conflict(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new ProductError(409, 'SKU já cadastrado. Nenhum produto foi importado ou alterado.');
    }
    throw error;
  }
  async createMany(products: ProductInput[], source: 'manual' | 'csv', actorId: string) {
    try {
      return await this.db.transaction(async (client) => {
        const created: CatalogProduct[] = [];
        for (const p of [...products].sort((a, b) => a.sku.localeCompare(b.sku))) {
          const result = await client.query<CatalogProduct>(`INSERT INTO products
            (sku,name,description,unit,cost_price,sale_price,minimum_stock,lead_time_days,active,source)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${columns}`, [...values(p), source]);
          const product = result.rows[0]!;
          await this.event(client, product, actorId, 'product.created');
          created.push(product);
        }
        return created;
      });
    } catch (error) { return this.conflict(error); }
  }
  async update(id: string, version: number, input: ProductInput, actorId: string) {
    try {
      return await this.db.transaction(async (client) => {
        const result = await client.query<CatalogProduct>(`UPDATE products SET sku=$1,name=$2,description=$3,unit=$4,
          cost_price=$5,sale_price=$6,minimum_stock=$7,lead_time_days=$8,active=$9,version=version+1,updated_at=now()
          WHERE id=$10 AND version=$11 RETURNING ${columns}`, [...values(input), id, version]);
        const product = result.rows[0];
        if (!product) {
          const exists = await client.query('SELECT 1 FROM products WHERE id=$1', [id]);
          throw new ProductError(exists.rowCount ? 409 : 404, exists.rowCount ? 'Produto alterado por outra pessoa. Atualize a lista e tente novamente.' : 'Produto não encontrado.');
        }
        await this.event(client, product, actorId, 'product.updated');
        return product;
      });
    } catch (error) { return this.conflict(error); }
  }
}
