import type { OrderRepository } from "./OrderRepository";

export class GetOrderForCustomer {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderId: string, customerId: string) {
    const order = await this.orders.findById(orderId);
    if (!order || !order.customerId || order.customerId !== customerId) return null;
    return order;
  }
}
