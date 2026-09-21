export interface TechnicianPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
  verifyUnknownAccount(password: string): Promise<void>;
}
