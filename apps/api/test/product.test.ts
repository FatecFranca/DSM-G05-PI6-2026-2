import assert from 'node:assert/strict';
import { it } from 'node:test';
import { productInputSchema } from '../src/domain/product.js';
import { CsvProductSource } from '../src/infrastructure/sources/csv-product-source.js';

it('normaliza SKU e unidade e preserva preço decimal como texto', () => {
  const product = productInputSchema.parse({ sku: ' cafe-01 ', name: ' Café ', unit: ' un ', salePrice: '12.3400' });
  assert.equal(product.sku, 'CAFE-01');
  assert.equal(product.unit, 'UN');
  assert.equal(product.salePrice, '12.3400');
});
it('rejeita preço negativo, precisão excessiva e campos externos no cadastro', () => {
  for (const extra of [{ salePrice: '-1' }, { salePrice: '1.12345' }, { externalId: '123' }, { stock: 10 }]) {
    assert.equal(productInputSchema.safeParse({ sku: 'A', name: 'Produto', ...extra }).success, false);
  }
});
it('CSV suporta BOM, ponto e vírgula, aspas e vírgula decimal', () => {
  const rows = new CsvProductSource().read('\uFEFFsku;name;unit;salePrice\nA;"Café; especial";UN;12,50');
  assert.equal(rows[0]!.name, 'Café; especial');
  assert.equal(rows[0]!.salePrice, '12.50');
});
it('CSV rejeita cabeçalho inválido, SKU duplicado e arquivos vazios', () => {
  for (const csv of ['', 'sku;name;stock\nA;Produto;10', 'sku;name\na;Produto\nA;Outro', 'sku;sku;name\nA;B;Produto']) {
    assert.throws(() => new CsvProductSource().read(csv));
  }
});
