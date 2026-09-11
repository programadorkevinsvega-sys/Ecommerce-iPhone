import type { Order } from "../domain/Order";

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
}
