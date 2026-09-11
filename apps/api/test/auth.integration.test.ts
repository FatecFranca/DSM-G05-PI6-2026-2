import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import { PostgresDatabase } from '../src/infrastructure/database/postgres-database.js';
import { hashToken } from '../src/infrastructure/security/password-hasher.js';

// Schema exclusivo e descartável; nunca limpa tabelas do projeto.
describe('Autenticação com PostgreSQL real', { skip: process.env.AUTH_INTEGRATION !== '1' }, () => {
  const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
  const email = 'pessoa@example.com';
  const password = 'minha primeira frase segura';
  const newPassword = 'minha segunda frase segura';
  let app: FastifyInstance;
  let db: PostgresDatabase;
  let owner: PostgresDatabase;
  let created = false;
  let cookie = '';
  let resetToken = '';
  const messages: { email: string; url: string }[] = [];
  const headers = { origin: 'http://localhost:3000', 'x-requested-with': 'EstoqueInteligente' };
  const post = (action: string, body: object, session = '') => app.inject({
    method: 'POST', url: `/api/v1/auth/${action}`, payload: body, headers: { ...headers, cookie: session },
  });

  before(async () => {
    const config = getConfig();
    owner = new PostgresDatabase(config.databaseUrl, 1);
    await owner.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    const url = new URL(config.databaseUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    db = new PostgresDatabase(url.toString(), 5);
    await db.query(await readFile(new URL('../../../infra/database/migrations/002_authentication.sql', import.meta.url), 'utf8'));
    app = await buildApp({ logger: false,
      env: { NODE_ENV: 'test', DATABASE_URL: url.toString() },
      mailer: { async sendReset(email, url) { messages.push({ email, url }); } },
    });
  });

  after(async () => {
    await app?.close();
    await db?.close();
    if (created) { await owner.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await owner?.close();
  });

  it('nega consulta de estoque sem sessão e bloqueia CSRF antes de cadastrar', async () => {
    for (const path of ['products', 'dashboard/summary', 'forecasts', 'sync-runs']) {
      assert.equal((await app.inject(`/api/v1/${path}`)).statusCode, 401);
    }
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/register',
      payload: { name: 'Pessoa', email, password }, headers: { origin: 'https://evil.example' } });
    assert.equal(response.statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/login',
      payload: { email, password }, headers: { ...headers, origin: 'https://evil.example' } })).statusCode, 403);
  });

  it('valida senha e não aceita privilégios enviados pelo cliente', async () => {
    assert.equal((await post('register', { name: 'Pessoa', email, password: 'curta' })).statusCode, 400);
    assert.equal((await post('register', { name: 'Pessoa', email, password, role: 'admin' })).statusCode, 400);
  });

  it('cadastra com e-mail normalizado, senha em hash e papel de consulta', async () => {
    const response = await post('register', { name: 'Pessoa Teste', email: ' PESSOA@example.com ', password });
    assert.equal(response.statusCode, 201, response.body);
    assert.equal(response.json().user.email, email);
    assert.equal(response.json().user.role, 'viewer');
    assert.equal(response.json().user.password_hash, undefined);
    const stored = (await db.query('SELECT password_hash FROM users WHERE email=$1', [email])).rows[0]!;
    assert.match(stored.password_hash, /^\$argon2id\$/);
    assert.notEqual(stored.password_hash, password);
    assert.equal((await post('register', { name: 'Duplicada', email, password })).statusCode, 409);
  });

  it('não autentica senha errada nem SQL injection', async () => {
    const wrong = await post('login', { email, password: 'senha errada' });
    const missing = await post('login', { email: 'ausente@example.com', password });
    assert.equal(wrong.statusCode, 401);
    assert.equal(missing.statusCode, 401);
    assert.equal(wrong.body, missing.body);
    assert.equal((await post('login', { email, password: "' OR 1=1 --" })).statusCode, 401);
  });

  it('inicia sessão com cookie HttpOnly e não revela o token no JSON', async () => {
    const response = await post('login', { email, password, remember: true });
    assert.equal(response.statusCode, 200, response.body);
    const setCookie = String(response.headers['set-cookie']);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Expires=/);
    cookie = setCookie.split(';')[0]!;
    assert.equal(response.json().token, undefined);
    const rawToken = cookie.split('=')[1]!;
    const stored = (await db.query('SELECT token_hash FROM auth_sessions')).rows[0]!;
    assert.equal(stored.token_hash, hashToken(rawToken));
    const me = await app.inject({ url: '/api/v1/auth/me', headers: { cookie } });
    assert.equal(me.json().user.email, email);
  });

  it('recuperação não revela conta e tokens antigos são invalidados', async () => {
    const known = await post('forgot-password', { email });
    const unknown = await post('forgot-password', { email: 'ausente@example.com' });
    assert.equal(known.statusCode, 200);
    assert.equal(known.body, unknown.body);
    assert.equal(messages.length, 1);
    const firstToken = new URL(messages[0]!.url).hash.slice('#token='.length);
    await post('forgot-password', { email });
    resetToken = new URL(messages[1]!.url).hash.slice('#token='.length);
    assert.equal((await post('reset-password', { token: firstToken, password: newPassword })).statusCode, 400);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM password_reset_tokens WHERE token_hash=$1', [hashToken(resetToken)])).rows[0]!.count, 1);
  });

  it('consome recuperação uma única vez, mesmo concorrente, e revoga sessões', async () => {
    const responses = await Promise.all([post('reset-password', { token: resetToken, password: newPassword }), post('reset-password', { token: resetToken, password: newPassword })]);
    assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 400]);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie } })).statusCode, 401);
    assert.equal((await post('login', { email, password })).statusCode, 401);
    const login = await post('login', { email, password: newPassword });
    assert.equal(login.statusCode, 200);
    cookie = String(login.headers['set-cookie']).split(';')[0]!;
  });

  it('troca de senha exige senha atual e encerra a sessão', async () => {
    assert.equal((await post('change-password', { currentPassword: 'errada', password }, cookie)).statusCode, 400);
    assert.equal((await post('change-password', { currentPassword: newPassword, password }, cookie)).statusCode, 200);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie } })).statusCode, 401);
  });

  it('logout revoga no servidor; sessão expirada não funciona', async () => {
    const login = await post('login', { email, password });
    cookie = String(login.headers['set-cookie']).split(';')[0]!;
    assert.equal((await post('logout', {}, cookie)).statusCode, 200);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie } })).statusCode, 401);
    await db.query(`INSERT INTO auth_sessions(token_hash,user_id,expires_at)
      SELECT $1,id,now()-interval '1 second' FROM users WHERE email=$2`, [hashToken('b'.repeat(43)), email]);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: `estoque_session=${'b'.repeat(43)}` } })).statusCode, 401);
  });

  it('recusa links expirados, contas desativadas e cookies adulterados', async () => {
    await db.query(`INSERT INTO password_reset_tokens(token_hash,user_id,expires_at)
      SELECT $1,id,now()-interval '1 second' FROM users WHERE email=$2`, [hashToken('c'.repeat(43)), email]);
    assert.equal((await post('reset-password', { token: 'c'.repeat(43), password })).statusCode, 400);
    assert.equal((await app.inject({ url: '/api/v1/auth/me', headers: { cookie: 'estoque_session=invalido' } })).statusCode, 401);
    await db.query('UPDATE users SET active=false WHERE email=$1', [email]);
    assert.equal((await post('login', { email, password })).statusCode, 401);
    await db.query('UPDATE users SET active=true WHERE email=$1', [email]);
  });

  it('produção usa cookie Secure, fecha cadastro e protege Swagger', async () => {
    const url = new URL(getConfig().databaseUrl);
    url.searchParams.set('options', `-c search_path=${schema}`);
    const production = await buildApp({ logger: false, env: {
      NODE_ENV: 'production', DATABASE_URL: url.toString(), WEB_URL: 'https://estoque.example',
      MAIL_MODE: 'smtp', SMTP_URL: 'smtps://localhost:465',
    }, mailer: { async sendReset() {} } });
    try {
      const productionHeaders = { ...headers, origin: 'https://estoque.example' };
      assert.equal((await production.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { name: 'Pessoa', email, password }, headers: productionHeaders })).statusCode, 403);
      const login = await production.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password }, headers: productionHeaders });
      assert.equal(login.statusCode, 200, login.body);
      assert.match(String(login.headers['set-cookie']), /Secure/);
      assert.equal((await production.inject('/docs/json')).statusCode, 401);
      assert.equal((await production.inject({ url: '/docs/json', headers: { cookie: String(login.headers['set-cookie']).split(';')[0]! } })).statusCode, 403);
    } finally { await production.close(); }
  });

  it('limita tentativas por conta no PostgreSQL e mantém auditoria', async () => {
    // O mesmo limite é compartilhado por todas as instâncias da API.
    await db.query('INSERT INTO auth_rate_limits(key_hash,attempts,expires_at) VALUES($1,10,now()+interval \'15 minutes\') ON CONFLICT(key_hash) DO UPDATE SET attempts=10', [hashToken(`login:${email}`)]);
    assert.equal((await post('login', { email, password })).statusCode, 429);
    const logs = await db.query('SELECT event FROM audit_logs');
    for (const event of ['user.registered', 'session.created', 'session.revoked', 'password.reset', 'password.changed']) {
      assert.ok(logs.rows.some((row) => row.event === event));
    }
  });
});
