export type CustomerSession = Readonly<{
  id: string;
  customerId: string;
  expiresAt: string;
}>;

export interface CustomerSessionRepository {
  create(customerId: string, tokenHash: string, expiresAt: string): Promise<CustomerSession>;
  findActiveByTokenHash(tokenHash: string): Promise<CustomerSession | null>;
  revoke(id: string): Promise<void>;
}
