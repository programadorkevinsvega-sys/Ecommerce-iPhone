import type { Order } from "../domain/Order";

export interface OrderIdempotencyLookup {
  findByIdempotencyKeyForCustomer(key: string, customerId: string): Promise<Order | null>;
}
