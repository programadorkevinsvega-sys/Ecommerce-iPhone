export type InventoryRepository = {
  findAdjustment(idempotencyKey: string): Promise<unknown | null>;
  findProduct(productId: string): Promise<Readonly<{ id: string; name: string; stock: number }> | null>;
  adjustStock(productId: string, delta: number, adminUserId: string, reason: string, idempotencyKey: string): Promise<Readonly<{ id: string; productId: string; delta: number; stock: number }>>;
  listAdjustments(productId?: string, limit?: number, offset?: number): Promise<unknown[]>;
};

export class AdminInventory {
  constructor(private readonly repository: InventoryRepository) {}
  async adjust(productId: string, delta: number, reason: string, idempotencyKey: string, adminUserId: string) {
    const id = productId.trim();
    const why = reason.trim();
    const key = idempotencyKey.trim();
    if (!id || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000 || !why || why.length > 500 || !key || key.length > 255) throw new Error("INVALID_INVENTORY_ADJUSTMENT");
    if (await this.repository.findAdjustment(key)) return this.repository.findAdjustment(key);
    if (!await this.repository.findProduct(id)) throw new Error("PRODUCT_NOT_FOUND");
    return this.repository.adjustStock(id, delta, adminUserId, why, key);
  }
  async list(productId?: string, limit = 50, offset = 0) {
    return this.repository.listAdjustments(productId?.trim() || undefined, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0));
  }
}
