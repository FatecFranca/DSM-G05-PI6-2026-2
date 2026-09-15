import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { PostgresDatabase } from '../src/infrastructure/database/postgres-database.js';

describe('Catálogo com PostgreSQL real', { skip: process.env.AUTH_INTEGRATION !== '1' }, () => {
  const schema = `products_test_${randomUUID().replaceAll('-', '')}`;
  let owner: PostgresDatabase;
  let db: PostgresDatabase;
  let app: FastifyInstance;
  let created = false;
  let admin = '';
  let viewer = '';
  let id = '';
  const input = { sku: 'TEST-01', name: 'Produto teste', salePrice: '19.99' };
  const post = (path: string, payload: object, cookie = admin) => app.inject({ method: 'POST', url: `/api/v1/${path}`, payload,
    headers: { cookie, origin: 'http://localhost:3000', 'x-requested-with': 'EstoqueInteligente' } });
  const put = (path: string, payload: object) => app.inject({ method: 'PUT', url: `/api/v1/${path}`, payload,
    headers: { cookie: admin, origin: 'http://localhost:3000', 'x-requested-with': 'EstoqueInteligente' } });
  before(async () => {
    const config = getConfig();
    owner = new PostgresDatabase(config.databaseUrl, 1);
    await owner.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    const url = new URL(config.databaseUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PostgresDatabase(url.toString(), 5);
    for (const file of ['schema.sql', 'migrations/002_authentication.sql', 'migrations/003_product_catalog.sql']) {
      const sql = await readFile(new URL(`../../../infra/database/${file}`, import.meta.url), 'utf8');
      await db.query(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', ''));
    }
    app = await buildApp({ logger: false, env: { NODE_ENV: 'test', DATABASE_URL: url.toString() }, mailer: { async sendReset() {} } });
    for (const role of ['admin', 'viewer']) {
      const email = `${role}@example.com`;
      const password = 'frase segura para testes';
      assert.equal((await post('auth/register', { email, name: role, password }, '')).statusCode, 201);
      if (role === 'admin') await db.query('UPDATE users SET role=$1 WHERE email=$2', ['admin', email]);
      const login = await post('auth/login', { email, password }, '');
      assert.equal(login.statusCode, 200);
      const cookie = String(login.headers['set-cookie']).split(';')[0]!;
      if (role === 'admin') admin = cookie; else viewer = cookie;
    }
  });
  after(async () => {
    await app?.close(); await db?.close();
    if (created) await owner.query(`DROP SCHEMA "${schema}" CASCADE`);
    await owner?.close();
  });
  it('exige sessão, papel admin e proteção CSRF para escrever', async () => {
    assert.equal((await app.inject('/api/v1/catalog/products')).statusCode, 401);
    assert.equal((await post('catalog/products', input, viewer)).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: input, headers: { cookie: admin } })).statusCode, 403);
  });
  it('cadastra sem Bling e persiste produto, auditoria e evento juntos', async () => {
    const result = await post('catalog/products', input);
    assert.equal(result.statusCode, 201, result.body);
    const product = result.json().product;
    id = product.id;
    assert.equal(product.source, 'manual');
    assert.equal(product.version, 1);
    assert.equal(product.salePrice, '19.9900');
    assert.equal((await db.query('SELECT external_id FROM products WHERE id=$1', [id])).rows[0]!.external_id, null);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM outbox_events WHERE aggregate_id=$1', [id])).rows[0]!.n, 1);
    assert.equal((await post('catalog/products', { ...input, sku: ' test-01 ' })).statusCode, 409);
  });
  it('busca paginada aceita viewer e trata SQL injection como texto', async () => {
    const result = await app.inject({ url: '/api/v1/catalog/products?search=TEST-01&pageSize=1', headers: { cookie: viewer } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().total, 1);
    const injection = await app.inject({ url: `/api/v1/catalog/products?search=${encodeURIComponent("' OR 1=1 --")}`, headers: { cookie: viewer } });
    assert.equal(injection.json().total, 0);
  });
  it('edição concorrente não sobrescreve silenciosamente; inativação preserva registro', async () => {
    const results = await Promise.all([put(`catalog/products/${id}`, { version: 1, product: { ...input, active: false } }),
      put(`catalog/products/${id}`, { version: 1, product: { ...input, active: false } })]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const row = (await db.query('SELECT active,version FROM products WHERE id=$1', [id])).rows[0]!;
    assert.equal(row.active, false); assert.equal(row.version, 2);
  });
  it('prévia não grava; conflito no CSV desfaz o lote inteiro e sua outbox', async () => {
    const csv = 'sku;name\nAAA-NEW;Novo produto\nTEST-01;Duplicado';
    assert.equal((await post('catalog/import', { csv, preview: true })).statusCode, 200);
    assert.equal((await post('catalog/import', { csv, preview: false })).statusCode, 409);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM products WHERE sku='AAA-NEW'")).rows[0]!.n, 0);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM outbox_events')).rows[0]!.n, 2);
  });
  it('importa CSV válido sem duplicar em reenvio e rejeita campos de saldo', async () => {
    const csv = 'sku;name;salePrice\nCSV-1;Produto importado;3,45';
    const result = await post('catalog/import', { csv, preview: false });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().data[0].source, 'csv');
    assert.equal((await post('catalog/import', { csv, preview: false })).statusCode, 409);
    assert.equal((await post('catalog/products', { ...input, stock: 20 })).statusCode, 400);
  });
});
