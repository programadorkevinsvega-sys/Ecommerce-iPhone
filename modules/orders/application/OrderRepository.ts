import type { Order } from "../domain/Order";

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  listByCustomer(customerId: string, limit: number, offset: number): Promise<readonly Order[]>;
  transitionStatus(id: string, from: string, to: string): Promise<boolean>;
}

export interface OrderIdempotencyLookup {
  findByIdempotencyKeyForCustomer(key: string, customerId: string): Promise<Order | null>;
}
