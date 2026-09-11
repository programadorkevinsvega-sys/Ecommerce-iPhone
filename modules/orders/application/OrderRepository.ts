import type { Order } from "../domain/Order";

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  listByCustomer(customerId: string, limit: number, offset: number): Promise<readonly Order[]>;
}
