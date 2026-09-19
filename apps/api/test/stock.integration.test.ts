import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { PostgresDatabase } from '../src/infrastructure/database/postgres-database.js';
import { PostgresInventoryRepository } from '../src/infrastructure/repositories/postgres-inventory-repository.js';

describe('Movimentações com PostgreSQL real', { skip: process.env.AUTH_INTEGRATION !== '1' }, () => {
  const schema = `stock_test_${randomUUID().replaceAll('-', '')}`;
  let owner: PostgresDatabase; let db: PostgresDatabase; let app: FastifyInstance; let created = false;
  let admin = ''; let viewer = ''; let productId = ''; let warehouseId = ''; let secondWarehouseId = '';
  const headers = (cookie = admin) => ({ cookie, origin: 'http://localhost:3000', 'x-requested-with': 'EstoqueInteligente' });
  const post = (path: string, payload: object, cookie = admin) => app.inject({ method: 'POST', url: `/api/v1/${path}`, payload, headers: headers(cookie) });
  before(async () => {
    const config = getConfig(); owner = new PostgresDatabase(config.databaseUrl, 1);
    await owner.query(`CREATE SCHEMA "${schema}"`); created = true;
    const url = new URL(config.databaseUrl); url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PostgresDatabase(url.toString(), 6);
    for (const file of ['schema.sql', 'migrations/002_authentication.sql', 'migrations/003_product_catalog.sql', 'migrations/004_stock_movements.sql', 'migrations/005_warehouse_catalog.sql', 'migrations/006_public_dataset.sql']) {
      const sql = await readFile(new URL(`../../../infra/database/${file}`, import.meta.url), 'utf8');
      await db.query(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    }
    app = await buildApp({ logger: false, env: { NODE_ENV: 'test', DATABASE_URL: url.toString() }, mailer: { async sendReset() {} } });
    for (const role of ['admin', 'viewer']) {
      const email = `${role}@stock.example.com`; const password = 'frase segura para testes';
      assert.equal((await post('auth/register', { email, name: role, password }, '')).statusCode, 201);
      if (role === 'admin') await db.query('UPDATE users SET role=$1 WHERE email=$2', ['admin', email]);
      const login = await post('auth/login', { email, password }, ''); assert.equal(login.statusCode, 200);
      const cookie = String(login.headers['set-cookie']).split(';')[0]!; if (role === 'admin') admin = cookie; else viewer = cookie;
    }
    const product = await post('catalog/products', { sku: 'MOV-01', name: 'Produto movimentado', minimumStock: '2' });
    productId = product.json().product.id;
    warehouseId = (await db.query<{ id: string }>("SELECT id FROM warehouses WHERE external_id='deposito-principal'")).rows[0]!.id;
  });
  after(async () => {
    await app?.close(); await db?.close();
    if (created) await owner.query(`DROP SCHEMA "${schema}" CASCADE`); await owner?.close();
  });

  it('não soma previsões de versões antigas do modelo', async () => {
    const dataset = await db.query<{ id: string }>(`INSERT INTO dataset_versions
      (slug,version,source_url,doi,license,file_sha256,status,period_started_on,period_ended_on,imported_at)
      VALUES ('test','v1','https://example.com','test','test',repeat('a',64),'ready','2011-01-01','2011-12-09',now()) RETURNING id`);
    for (const [version, quantity, finished] of [['old', 100, '2026-01-01'], ['new', 12, '2026-02-01']] as const) {
      const run = await db.query<{ id: string }>(`INSERT INTO model_runs
        (task,algorithm,model_version,status,finished_at,dataset_version_id)
        VALUES ('forecast','test',$1,'succeeded',$2,$3) RETURNING id`, [version, finished, dataset.rows[0]!.id]);
      for (const horizon of [7, 30, 90]) {
        await db.query(`INSERT INTO demand_forecasts
          (product_id,model_run_id,generated_at,target_date,horizon_days,predicted_quantity)
          VALUES ($1,$2,now(),'2011-12-10',$3,$4)`, [productId, run.rows[0]!.id, horizon, quantity]);
      }
    }
    const repository = new PostgresInventoryRepository(db);
    for (const horizon of [7, 30, 90] as const) {
      const forecast = await repository.getForecast(horizon, productId);
      assert.equal(forecast.model, 'new');
      assert.equal(forecast.data.find((point) => point.date === '2011-12-10')?.forecast, 12);
    }
    assert.equal((await repository.listProducts({})).data.find((product) => product.id === productId)?.forecast, 12);
    assert.equal((await repository.getDashboardSummary()).demandSeries.find((point) => point.date === '2011-12-10')?.forecast, 12);
  });

  it('protege leitura por sessão e escrita por papel e CSRF', async () => {
    assert.equal((await app.inject('/api/v1/inventory/levels')).statusCode, 401);
    const payload = { type: 'entry', productId, warehouseId, quantity: '10', reason: 'Compra recebida' };
    assert.equal((await post('inventory/movements', payload, viewer)).statusCode, 403);
    assert.equal((await post('inventory/warehouses', { name: 'Depósito proibido' }, viewer)).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/inventory/movements', payload, headers: { cookie: admin } })).statusCode, 403);
  });

  it('cadastra um segundo depósito para habilitar transferências', async () => {
    const result = await post('inventory/warehouses', { name: 'Depósito secundário' });
    assert.equal(result.statusCode, 201, result.body); secondWarehouseId = result.json().warehouse.id;
    assert.equal((await post('inventory/warehouses', { name: ' depósito secundário ' })).statusCode, 409);
    const options = await app.inject({ url: '/api/v1/inventory/options', headers: { cookie: viewer } });
    assert.equal(options.statusCode, 200); assert.equal(options.json().warehouses.length, 2);
  });

  it('registra entrada, saída e ajuste com histórico, auditoria e outbox', async () => {
    const entry = await post('inventory/movements', { type: 'entry', productId, warehouseId, quantity: '10.5000', reason: 'Nota fiscal 123' });
    assert.equal(entry.statusCode, 201, entry.body); assert.equal(entry.json().level.onHand, '10.5000');
    const exit = await post('inventory/movements', { type: 'exit', productId, warehouseId, quantity: '2.25', reason: 'Consumo interno' });
    assert.equal(exit.statusCode, 201, exit.body); assert.equal(exit.json().level.onHand, '8.2500');
    const adjustment = await post('inventory/movements', { type: 'adjustment', productId, warehouseId, targetQuantity: '9', reason: 'Contagem física' });
    assert.equal(adjustment.statusCode, 201, adjustment.body); assert.equal(adjustment.json().movement.quantityDelta, '0.7500');
    const history = await app.inject({ url: `/api/v1/inventory/movements?productId=${productId}`, headers: { cookie: viewer } });
    assert.equal(history.statusCode, 200); assert.equal(history.json().total, 3);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_type='inventory'")).rows[0]!.n, 3);
  });

  it('preserva reservas e serializa saídas concorrentes', async () => {
    await db.query('UPDATE inventory_levels SET reserved_quantity=8 WHERE product_id=$1 AND warehouse_id=$2', [productId, warehouseId]);
    const blocked = await post('inventory/movements', { type: 'exit', productId, warehouseId, quantity: '2', reason: 'Saída sem saldo' });
    assert.equal(blocked.statusCode, 409);
    await db.query('UPDATE inventory_levels SET reserved_quantity=0,on_hand_quantity=5 WHERE product_id=$1 AND warehouse_id=$2', [productId, warehouseId]);
    const results = await Promise.all([1, 2].map(() => post('inventory/movements', { type: 'exit', productId, warehouseId, quantity: '4', reason: 'Concorrência controlada' })));
    assert.deepEqual(results.map((result) => result.statusCode).sort(), [201, 409]);
    assert.equal((await db.query('SELECT on_hand_quantity::text AS value FROM inventory_levels WHERE product_id=$1 AND warehouse_id=$2', [productId, warehouseId])).rows[0]!.value, '1.0000');
  });

  it('transfere atomicamente entre depósitos e gera duas pernas ligadas', async () => {
    await post('inventory/movements', { type: 'entry', productId, warehouseId, quantity: '5', reason: 'Reposição' });
    const result = await post('inventory/transfers', { productId, fromWarehouseId: warehouseId, toWarehouseId: secondWarehouseId, quantity: '3', reason: 'Balanceamento' });
    assert.equal(result.statusCode, 201, result.body); assert.equal(result.json().from.onHand, '3.0000'); assert.equal(result.json().to.onHand, '3.0000');
    const rows = await db.query<{ type: string; transfer_id: string }>('SELECT movement_type AS type,transfer_id FROM stock_movements WHERE transfer_id=$1 ORDER BY movement_type', [result.json().transferId]);
    assert.deepEqual(rows.rows.map((row) => row.type), ['transfer_in', 'transfer_out']);
  });

  it('lista saldos paginados e trata tentativa de SQL injection como texto', async () => {
    const list = await app.inject({ url: `/api/v1/inventory/levels?warehouseId=${warehouseId}&search=MOV-01`, headers: { cookie: viewer } });
    assert.equal(list.statusCode, 200); assert.equal(list.json().total, 1); assert.equal(list.json().data[0].onHand, '3.0000');
    const injection = await app.inject({ url: `/api/v1/inventory/levels?search=${encodeURIComponent("' OR 1=1 --")}`, headers: { cookie: viewer } });
    assert.equal(injection.statusCode, 200); assert.equal(injection.json().total, 0);
  });
});
