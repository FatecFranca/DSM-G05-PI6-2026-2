import test from 'node:test';
import assert from 'node:assert/strict';
import { connectForecastSeries } from '../src/lib/chart-data.mjs';

test('liga a previsão ao último valor real sem alterar as datas futuras', () => {
  const points = [
    { date: '2026-10-27', actual: 12, forecast: null, lower: null, upper: null },
    { date: '2026-10-28', actual: 15, forecast: null, lower: null, upper: null },
    { date: '2026-10-29', actual: null, forecast: 17, lower: 14, upper: 20 },
  ];

  const connected = connectForecastSeries(points);

  assert.notEqual(connected, points);
  assert.deepEqual(connected[1], {
    ...points[1], forecast: 15, lower: 15, upper: 15, forecastBridge: true,
  });
  assert.deepEqual(connected[2], points[2]);
});

test('não fabrica ligação quando não há histórico ou previsão futura', () => {
  const onlyActual = [{ date: '2026-10-28', actual: 15, forecast: null }];
  const onlyForecast = [{ date: '2026-10-29', actual: null, forecast: 17 }];
  assert.equal(connectForecastSeries(onlyActual), onlyActual);
  assert.equal(connectForecastSeries(onlyForecast), onlyForecast);
});
