import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCsv, formatReportDate } from '../src/lib/report-formatters.mjs';

test('CSV preserves accents, separators, quotes, nulls and zero', () => {
  assert.equal(serializeCsv([['Ação; "produto"', null, 0]]), '\uFEFF"Ação; ""produto""";"";"0"');
});
test('CSV neutralizes formulas including leading whitespace', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1', '\t=1', '\n=1']) {
    assert.equal(serializeCsv([[value]]), `\uFEFF"'${value}"`);
  }
});
test('CSV emits CRLF-separated records', () => {
  assert.equal(serializeCsv([['SKU'], ['00123']]), '\uFEFF"SKU"\r\n"00123"');
});
test('dates handle missing and malformed data without crashing', () => {
  assert.equal(formatReportDate(null), 'Não informado');
  assert.equal(formatReportDate('invalid'), 'Não informado');
  assert.equal(formatReportDate('2011-12-09'), '9 de dez. de 2011');
});
