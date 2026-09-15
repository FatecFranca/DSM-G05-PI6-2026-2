import type { User } from '../domain/auth.js';
import { ProductError, productInputSchema, type CatalogFilter, type ProductRepository, type ProductSource } from '../domain/product.js';

export class ProductService {
  constructor(private readonly repository: ProductRepository, private readonly csv: ProductSource) {}
  list(filter: CatalogFilter) { return this.repository.list(filter); }
  private requireAdmin(user: User) {
    if (user.role !== 'admin') throw new ProductError(403, 'Somente administradores podem alterar o catálogo.');
  }
  async create(input: unknown, user: User) {
    this.requireAdmin(user);
    const [product] = await this.repository.createMany([productInputSchema.parse(input)], 'manual', user.id);
    return product!;
  }
  update(id: string, version: number, input: unknown, user: User) {
    this.requireAdmin(user);
    return this.repository.update(id, version, productInputSchema.parse(input), user.id);
  }
  importCsv(content: string, user: User, preview: boolean) {
    this.requireAdmin(user);
    const products = this.csv.read(content);
    return preview ? Promise.resolve(products) : this.repository.createMany(products, 'csv', user.id);
  }
}
