import { z } from 'zod';
import type { User } from './auth.js';

const quantity = z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/, 'Use um valor com até quatro casas decimais.')
  .refine((value) => Number(value) > 0, 'A quantidade deve ser maior que zero.');
const nonnegativeQuantity = z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/, 'Use um valor com até quatro casas decimais.');
const reason = z.string().trim().min(3).max(500);
export const warehouseInputSchema = z.object({ name: z.string().trim().min(2).max(120) }).strict();

export const movementInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('entry'), productId: z.uuid(), warehouseId: z.uuid(), quantity, reason }).strict(),
  z.object({ type: z.literal('exit'), productId: z.uuid(), warehouseId: z.uuid(), quantity, reason }).strict(),
  z.object({ type: z.literal('adjustment'), productId: z.uuid(), warehouseId: z.uuid(), targetQuantity: nonnegativeQuantity, reason }).strict(),
]);
export const transferInputSchema = z.object({
  productId: z.uuid(), fromWarehouseId: z.uuid(), toWarehouseId: z.uuid(), quantity, reason,
}).strict().refine((value) => value.fromWarehouseId !== value.toWarehouseId,
  { message: 'Os depósitos de origem e destino devem ser diferentes.', path: ['toWarehouseId'] });

export type MovementInput = z.infer<typeof movementInputSchema>;
export type TransferInput = z.infer<typeof transferInputSchema>;
export type StockFilter = { search: string; warehouseId?: string | undefined; page: number; pageSize: number };
export type MovementFilter = { productId?: string | undefined; warehouseId?: string | undefined; type?: string | undefined; page: number; pageSize: number };
export type StockLevel = {
  productId: string; sku: string; productName: string; unit: string; minimumStock: string;
  warehouseId: string; warehouseName: string; onHand: string; reserved: string; available: string; updatedAt: string;
};
export type StockMovement = {
  id: string; productId: string; sku: string; productName: string; warehouseId: string; warehouseName: string;
  type: string; quantityDelta: string; resultingOnHand: string | null; reason: string; source: string;
  transferId: string | null; actorName: string | null; occurredAt: string;
};
export interface StockRepository {
  options(): Promise<{ products: { id: string; sku: string; name: string; unit: string }[]; warehouses: { id: string; name: string }[] }>;
  levels(filter: StockFilter): Promise<{ data: StockLevel[]; total: number }>;
  movements(filter: MovementFilter): Promise<{ data: StockMovement[]; total: number }>;
  apply(input: MovementInput, actor: User): Promise<{ level: StockLevel; movement: StockMovement }>;
  transfer(input: TransferInput, actor: User): Promise<{ from: StockLevel; to: StockLevel; transferId: string }>;
  createWarehouse(name: string, actor: User): Promise<{ id: string; name: string }>;
}
export class StockError extends Error {
  constructor(public readonly statusCode: number, message: string) { super(message); }
}
