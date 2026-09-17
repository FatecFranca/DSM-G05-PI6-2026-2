import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { movementInputSchema, transferInputSchema, warehouseInputSchema } from '../src/domain/stock.js';

const id = '10000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';

describe('regras de entrada das movimentações', () => {
  it('aceita quantidades decimais como texto sem arredondamento binário', () => {
    const parsed = movementInputSchema.parse({ type: 'entry', productId: id, warehouseId: other, quantity: '10.1250', reason: 'Compra recebida' });
    assert.equal(parsed.type, 'entry');
    if (parsed.type === 'entry') assert.equal(parsed.quantity, '10.1250');
  });
  it('rejeita quantidade zero, número JS e campos inesperados', () => {
    for (const quantity of ['0', -1, 2.5]) {
      assert.equal(movementInputSchema.safeParse({ type: 'exit', productId: id, warehouseId: other, quantity, reason: 'Teste inválido' }).success, false);
    }
    assert.equal(movementInputSchema.safeParse({ type: 'entry', productId: id, warehouseId: other, quantity: '1', reason: 'Teste', externalId: 'erp-1' }).success, false);
  });
  it('impede transferência para o mesmo depósito', () => {
    assert.equal(transferInputSchema.safeParse({ productId: id, fromWarehouseId: other, toWarehouseId: other, quantity: '1', reason: 'Reposição interna' }).success, false);
  });
  it('normaliza nome do depósito e rejeita campos de integração', () => {
    assert.equal(warehouseInputSchema.parse({ name: '  Loja Centro  ' }).name, 'Loja Centro');
    assert.equal(warehouseInputSchema.safeParse({ name: 'Loja Centro', externalId: 'erp-1' }).success, false);
  });
});
