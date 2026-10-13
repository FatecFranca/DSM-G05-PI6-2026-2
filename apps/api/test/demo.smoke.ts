// Read-only smoke check of an already populated local demonstration.
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.js';
import { PostgresDatabase } from '../src/infrastructure/database/postgres-database.js';
import { PostgresInventoryRepository } from '../src/infrastructure/repositories/postgres-inventory-repository.js';
import { PostgresProductRepository } from '../src/infrastructure/repositories/postgres-product-repository.js';

const db = new PostgresDatabase(getConfig().databaseUrl, 3);
try {
  const repository = new PostgresInventoryRepository(db);
  const summary = await repository.getDashboardSummary();
  const dataset = await repository.getCurrentDataset();
  assert.equal(summary.meta.demo, true);
  assert.equal(summary.kpis.stockValueCurrency, 'BRL');
  assert.equal(dataset?.isSimulated, true);
  const catalog = await new PostgresProductRepository(db).list({ search: '', status: 'active', page: 1, pageSize: 100 });
  assert.equal(catalog.data.filter((p) => p.source === 'simulated').length, 48);
  assert.ok(catalog.data.every((p) => p.source !== 'uci_online_retail'));
  const forecasts = [];
  for (const horizon of [7, 30, 90] as const) {
    const forecast = await repository.getForecast(horizon);
    const points = forecast.data.filter((p) => p.forecast !== null);
    assert.equal(points.length, horizon);
    assert.equal(forecast.demo, true);
    assert.ok(points.every((p) => Number.isFinite(p.forecast) && p.forecast! >= 0));
    assert.ok(points[0]!.date > dataset!.periodEndedOn!);
    forecasts.push({ horizon, first: points[0]!.date, last: points.at(-1)!.date, wape: forecast.metrics?.wape });
  }
  const original = await db.query<{ n: number; currency: string }>("SELECT count(*)::int AS n,min(currency) AS currency FROM products WHERE source='uci_online_retail'");
  assert.ok(original.rows[0]!.n > 0);
  assert.equal(original.rows[0]!.currency, 'GBP');
  console.info(JSON.stringify({ summary: summary.kpis, dataset: dataset?.name, periodEnd: dataset?.periodEndedOn,
    records: dataset?.recordsAccepted, originalProductsPreserved: original.rows[0]!.n, forecasts }, null, 2));
} finally {
  await db.close();
}
