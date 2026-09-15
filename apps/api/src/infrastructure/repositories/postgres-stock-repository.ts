import type { PoolClient } from 'pg';
import type { User } from '../../domain/auth.js';
import { StockError, type MovementFilter, type MovementInput, type StockFilter, type StockLevel, type StockMovement, type StockRepository, type TransferInput } from '../../domain/stock.js';
import type { PostgresDatabase } from '../database/postgres-database.js';

const levelColumns = `p.id AS "productId", p.sku, p.name AS "productName", p.unit,
  COALESCE(p.minimum_stock,0)::text AS "minimumStock", w.id AS "warehouseId", w.name AS "warehouseName",
  COALESCE(l.on_hand_quantity,0)::text AS "onHand", COALESCE(l.reserved_quantity,0)::text AS reserved,
  COALESCE(l.available_quantity,0)::text AS available, COALESCE(l.updated_at,p.updated_at)::text AS "updatedAt"`;
const movementColumns = `m.id, p.id AS "productId", p.sku, p.name AS "productName", w.id AS "warehouseId",
  w.name AS "warehouseName", m.movement_type AS type, m.quantity_delta::text AS "quantityDelta",
  m.resulting_on_hand::text AS "resultingOnHand", COALESCE(m.reason,'') AS reason, m.source,
  m.transfer_id::text AS "transferId", u.name AS "actorName", m.occurred_at::text AS "occurredAt"`;

export class PostgresStockRepository implements StockRepository {
  constructor(private readonly db: PostgresDatabase) {}

  async options() {
    const [products, warehouses] = await Promise.all([
      this.db.query<{ id: string; sku: string; name: string; unit: string }>('SELECT id,sku,name,unit FROM products WHERE active ORDER BY name,id'),
      this.db.query<{ id: string; name: string }>('SELECT id,name FROM warehouses WHERE active ORDER BY name,id'),
    ]);
    return { products: products.rows, warehouses: warehouses.rows };
  }

  async createWarehouse(name: string, actor: User) {
    try {
      return await this.db.transaction(async (client) => {
        const warehouse = (await client.query<{ id: string; name: string }>(`INSERT INTO warehouses(external_id,name,source)
          VALUES(NULL,$1,'manual') RETURNING id,name`, [name])).rows[0]!;
        await client.query('INSERT INTO audit_logs(user_id,event) VALUES($1,$2)', [actor.id, 'warehouse.created']);
        await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,correlation_id,payload)
          VALUES('warehouse',$1,'warehouse.created',gen_random_uuid(),$2::jsonb)`, [warehouse.id, JSON.stringify({ warehouseId: warehouse.id, actorId: actor.id })]);
        return warehouse;
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new StockError(409, 'Já existe um depósito ativo com esse nome.');
      }
      throw error;
    }
  }

  async levels(filter: StockFilter) {
    const where = `p.active AND w.active AND ($1::uuid IS NULL OR w.id=$1)
      AND ($2='' OR strpos(lower(p.name),lower($2))>0 OR strpos(lower(p.sku),lower($2))>0)`;
    const values = [filter.warehouseId ?? null, filter.search];
    const [data, count] = await Promise.all([
      this.db.query<StockLevel>(`SELECT ${levelColumns} FROM products p CROSS JOIN warehouses w
        LEFT JOIN inventory_levels l ON l.product_id=p.id AND l.warehouse_id=w.id
        WHERE ${where} ORDER BY p.name,w.name,p.id,w.id LIMIT $3 OFFSET $4`,
      [...values, filter.pageSize, (filter.page - 1) * filter.pageSize]),
      this.db.query<{ total: number }>(`SELECT count(*)::int AS total FROM products p CROSS JOIN warehouses w WHERE ${where}`, values),
    ]);
    return { data: data.rows, total: count.rows[0]!.total };
  }

  async movements(filter: MovementFilter) {
    const where = `($1::uuid IS NULL OR m.product_id=$1) AND ($2::uuid IS NULL OR m.warehouse_id=$2)
      AND ($3='' OR m.movement_type=$3)`;
    const values = [filter.productId ?? null, filter.warehouseId ?? null, filter.type ?? ''];
    const joins = `FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN warehouses w ON w.id=m.warehouse_id
      LEFT JOIN users u ON u.id=m.actor_id`;
    const [data, count] = await Promise.all([
      this.db.query<StockMovement>(`SELECT ${movementColumns} ${joins} WHERE ${where}
        ORDER BY m.occurred_at DESC,m.id DESC LIMIT $4 OFFSET $5`, [...values, filter.pageSize, (filter.page - 1) * filter.pageSize]),
      this.db.query<{ total: number }>(`SELECT count(*)::int AS total ${joins} WHERE ${where}`, values),
    ]);
    return { data: data.rows, total: count.rows[0]!.total };
  }

  private async ensureActive(client: PoolClient, productId: string, warehouseIds: string[]) {
    const valid = await client.query<{ warehouses: number }>(`SELECT count(DISTINCT w.id)::int AS warehouses
      FROM products p CROSS JOIN warehouses w WHERE p.id=$1 AND p.active AND w.id=ANY($2::uuid[]) AND w.active`, [productId, warehouseIds]);
    if (valid.rows[0]!.warehouses !== warehouseIds.length) throw new StockError(404, 'Produto ou depósito ativo não encontrado.');
    await client.query(`INSERT INTO inventory_levels(product_id,warehouse_id,measured_at)
      SELECT $1,w.id,now() FROM warehouses w WHERE w.id=ANY($2::uuid[]) ORDER BY w.id ON CONFLICT DO NOTHING`, [productId, warehouseIds]);
  }

  private async lockLevels(client: PoolClient, productId: string, warehouseIds: string[]) {
    await this.ensureActive(client, productId, warehouseIds);
    const result = await client.query<{ warehouseId: string; onHand: string; reserved: string }>(`SELECT warehouse_id AS "warehouseId",
      on_hand_quantity::text AS "onHand",reserved_quantity::text AS reserved FROM inventory_levels
      WHERE product_id=$1 AND warehouse_id=ANY($2::uuid[]) ORDER BY warehouse_id FOR UPDATE`, [productId, warehouseIds]);
    return result.rows;
  }

  private level(client: PoolClient, productId: string, warehouseId: string) {
    return client.query<StockLevel>(`SELECT ${levelColumns} FROM products p JOIN warehouses w ON w.id=$2
      LEFT JOIN inventory_levels l ON l.product_id=p.id AND l.warehouse_id=w.id WHERE p.id=$1`, [productId, warehouseId]);
  }

  private movement(client: PoolClient, id: string) {
    return client.query<StockMovement>(`SELECT ${movementColumns} FROM stock_movements m JOIN products p ON p.id=m.product_id
      JOIN warehouses w ON w.id=m.warehouse_id LEFT JOIN users u ON u.id=m.actor_id WHERE m.id=$1`, [id]);
  }

  private async recordEvent(client: PoolClient, actor: User, aggregateId: string, eventType: string, payload: object) {
    await client.query('INSERT INTO audit_logs(user_id,event) VALUES($1,$2)', [actor.id, eventType]);
    await client.query(`INSERT INTO outbox_events(aggregate_type,aggregate_id,event_type,correlation_id,payload)
      VALUES('inventory',$1,$2,gen_random_uuid(),$3::jsonb)`, [aggregateId, eventType, JSON.stringify({ ...payload, actorId: actor.id })]);
  }

  async apply(input: MovementInput, actor: User) {
    return this.db.transaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '5s'");
      const [current] = await this.lockLevels(client, input.productId, [input.warehouseId]);
      let updated;
      let deltaExpression: string;
      let deltaValues: unknown[];
      if (input.type === 'entry') {
        updated = await client.query<{ onHand: string }>(`UPDATE inventory_levels SET on_hand_quantity=on_hand_quantity+$3::numeric,
          measured_at=now(),updated_at=now() WHERE product_id=$1 AND warehouse_id=$2 RETURNING on_hand_quantity::text AS "onHand"`,
        [input.productId, input.warehouseId, input.quantity]);
        deltaExpression = '$5::numeric+COALESCE($6::numeric,0)'; deltaValues = [input.quantity, null];
      } else if (input.type === 'exit') {
        updated = await client.query<{ onHand: string }>(`UPDATE inventory_levels SET on_hand_quantity=on_hand_quantity-$3::numeric,
          measured_at=now(),updated_at=now() WHERE product_id=$1 AND warehouse_id=$2
          AND on_hand_quantity-$3::numeric>=reserved_quantity RETURNING on_hand_quantity::text AS "onHand"`,
        [input.productId, input.warehouseId, input.quantity]);
        if (!updated.rowCount) throw new StockError(409, 'Saldo disponível insuficiente para esta saída.');
        deltaExpression = '-$5::numeric+COALESCE($6::numeric,0)'; deltaValues = [input.quantity, null];
      } else {
        updated = await client.query<{ onHand: string }>(`UPDATE inventory_levels SET on_hand_quantity=$3::numeric,
          measured_at=now(),updated_at=now() WHERE product_id=$1 AND warehouse_id=$2
          AND $3::numeric>=reserved_quantity AND on_hand_quantity<>$3::numeric RETURNING on_hand_quantity::text AS "onHand"`,
        [input.productId, input.warehouseId, input.targetQuantity]);
        if (!updated.rowCount) {
          const check = await client.query<{ enough: boolean; same: boolean }>(`SELECT $3::numeric>=reserved_quantity AS enough,
            $3::numeric=on_hand_quantity AS same FROM inventory_levels WHERE product_id=$1 AND warehouse_id=$2`,
          [input.productId, input.warehouseId, input.targetQuantity]);
          throw new StockError(409, check.rows[0]?.same ? 'O saldo informado já é o saldo atual.' : 'O ajuste não pode ser menor que a quantidade reservada.');
        }
        deltaExpression = '$5::numeric-$6::numeric'; deltaValues = [input.targetQuantity, current!.onHand];
      }
      const reason = input.reason;
      const inserted = await client.query<{ id: string }>(`INSERT INTO stock_movements
        (product_id,warehouse_id,movement_type,quantity_delta,occurred_at,source,actor_id,reason,resulting_on_hand)
        VALUES($1,$2,$3,${deltaExpression},now(),'manual',$4,$7,$8::numeric) RETURNING id`,
      [input.productId, input.warehouseId, input.type, actor.id, ...deltaValues, reason, updated.rows[0]!.onHand]);
      await this.recordEvent(client, actor, input.productId, `stock.${input.type}`, {
        movementId: inserted.rows[0]!.id, productId: input.productId, warehouseId: input.warehouseId,
      });
      const [level, movement] = await Promise.all([this.level(client, input.productId, input.warehouseId), this.movement(client, inserted.rows[0]!.id)]);
      return { level: level.rows[0]!, movement: movement.rows[0]! };
    });
  }

  async transfer(input: TransferInput, actor: User) {
    return this.db.transaction(async (client) => {
      await client.query("SET LOCAL statement_timeout = '5s'");
      await this.lockLevels(client, input.productId, [input.fromWarehouseId, input.toWarehouseId]);
      const removed = await client.query<{ onHand: string }>(`UPDATE inventory_levels SET on_hand_quantity=on_hand_quantity-$3::numeric,
        measured_at=now(),updated_at=now() WHERE product_id=$1 AND warehouse_id=$2
        AND on_hand_quantity-$3::numeric>=reserved_quantity RETURNING on_hand_quantity::text AS "onHand"`,
      [input.productId, input.fromWarehouseId, input.quantity]);
      if (!removed.rowCount) throw new StockError(409, 'Saldo disponível insuficiente para esta transferência.');
      const added = await client.query<{ onHand: string }>(`UPDATE inventory_levels SET on_hand_quantity=on_hand_quantity+$3::numeric,
        measured_at=now(),updated_at=now() WHERE product_id=$1 AND warehouse_id=$2 RETURNING on_hand_quantity::text AS "onHand"`,
      [input.productId, input.toWarehouseId, input.quantity]);
      const transferId = (await client.query<{ id: string }>('SELECT gen_random_uuid()::text AS id')).rows[0]!.id;
      await client.query(`INSERT INTO stock_movements
        (product_id,warehouse_id,movement_type,quantity_delta,occurred_at,source,actor_id,reason,resulting_on_hand,transfer_id)
        VALUES($1,$2,'transfer_out',-$4::numeric,now(),'manual',$5,$6,$7::numeric,$3),
          ($1,$8,'transfer_in',$4::numeric,now(),'manual',$5,$6,$9::numeric,$3)`,
      [input.productId, input.fromWarehouseId, transferId, input.quantity, actor.id, input.reason, removed.rows[0]!.onHand,
        input.toWarehouseId, added.rows[0]!.onHand]);
      await this.recordEvent(client, actor, input.productId, 'stock.transferred', { transferId, productId: input.productId,
        fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, quantity: input.quantity });
      const [from, to] = await Promise.all([this.level(client, input.productId, input.fromWarehouseId), this.level(client, input.productId, input.toWarehouseId)]);
      return { from: from.rows[0]!, to: to.rows[0]!, transferId };
    });
  }
}
