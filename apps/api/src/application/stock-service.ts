import type { User } from '../domain/auth.js';
import { movementInputSchema, StockError, transferInputSchema, warehouseInputSchema, type MovementFilter, type StockFilter, type StockRepository } from '../domain/stock.js';

export class StockService {
  constructor(private readonly repository: StockRepository) {}
  options() { return this.repository.options(); }
  levels(filter: StockFilter) { return this.repository.levels(filter); }
  movements(filter: MovementFilter) { return this.repository.movements(filter); }
  private requireAdmin(user: User) {
    if (user.role !== 'admin') throw new StockError(403, 'Somente administradores podem movimentar o estoque.');
  }
  apply(input: unknown, user: User) {
    this.requireAdmin(user);
    return this.repository.apply(movementInputSchema.parse(input), user);
  }
  transfer(input: unknown, user: User) {
    this.requireAdmin(user);
    return this.repository.transfer(transferInputSchema.parse(input), user);
  }
  createWarehouse(input: unknown, user: User) {
    this.requireAdmin(user);
    return this.repository.createWarehouse(warehouseInputSchema.parse(input).name, user);
  }
}
