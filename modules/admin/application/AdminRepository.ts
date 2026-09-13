import type { AdminUser } from "../domain/AdminUser";

export type LoginFailureState = Readonly<{
  failedLoginCount: number;
  lockedUntil: string | undefined;
}>;

export interface AdminRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  save(user: AdminUser): Promise<void>;
  createInitialSuperAdmin(user: AdminUser): Promise<boolean>;
  recordFailedLogin(id: string, now: Date, maxAttempts: number, lockMinutes: number): Promise<LoginFailureState>;
  recordSuccessfulLogin(id: string, now: Date): Promise<void>;
}
