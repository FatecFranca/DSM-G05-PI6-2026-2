import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { buildApp } from '../src/app.js';

describe('Estoque Inteligente API', () => {
  let app;

  before(async () => {
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
  });

  it('responde ao health check', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'estoque-inteligente-api');
  });

  it('retorna o resumo demonstrativo do dashboard', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard/summary' });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.meta.demo, true);
    assert.equal(body.kpis.activeProducts, 1248);
    assert.ok(body.demandSeries.length > 0);
  });

  it('filtra produtos por texto e risco', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/products?search=caf%C3%A9&risk=critical',
    });
    const body = response.json();

    assert.equal(response.statusCode, 200);
    assert.equal(body.total, 1);
    assert.equal(body.data[0].sku, 'CAF-500-TD');
  });

  it('valida o horizonte da previsão', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/forecasts?horizon=14' });

    assert.equal(response.statusCode, 400);
  });

  it('mantém resposta de rota inexistente consistente', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/unknown' });
    const body = response.json();

    assert.equal(response.statusCode, 404);
    assert.equal(body.error, 'Not Found');
  });
});
