export interface ReservationRepository {
  releaseExpired(): Promise<number>;
}
