export interface ReservationRepository {
  releaseExpired(): Promise<number>;
  releaseForOrder(orderId: string): Promise<number>;
  consumeForOrder(orderId: string): Promise<number>;
  extendForOrder(orderId: string, minutes: number): Promise<number>;
}
