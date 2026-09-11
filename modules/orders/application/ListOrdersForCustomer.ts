import type { OrderRepository } from "./OrderRepository";

export type CustomerOrderPage = Readonly<{
  items: readonly Awaited<ReturnType<OrderRepository["findById"]>>[];
  limit: number;
  offset: number;
}>;

export class ListOrdersForCustomer {
  constructor(private readonly orders: OrderRepository) {}

  async execute(customerId: string, limit = 20, offset = 0): Promise<CustomerOrderPage> {
    if (!customerId) throw new Error("Customer authentication is required");
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const safeOffset = Math.max(Math.trunc(offset), 0);
    const items = await this.orders.listByCustomer(customerId, safeLimit, safeOffset);
    return { items, limit: safeLimit, offset: safeOffset };
  }
}
