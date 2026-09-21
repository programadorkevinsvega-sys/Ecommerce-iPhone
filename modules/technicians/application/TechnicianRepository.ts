import type { TechnicianUser } from "../domain/TechnicianUser";
export type TechnicianFailureState = Readonly<{ failedLoginCount: number; lockedUntil?: string }>;
export interface TechnicianRepository {
  findByEmail(email: string): Promise<TechnicianUser | null>;
  findById(id: string): Promise<TechnicianUser | null>;
  list(): Promise<readonly TechnicianUser[]>;
  save(user: TechnicianUser): Promise<void>;
  recordFailedLogin(id: string, now: Date, maxAttempts: number, lockMinutes: number): Promise<TechnicianFailureState>;
  recordSuccessfulLogin(id: string, now: Date): Promise<void>;
  audit(userId: string | null, eventType: string, resourceType?: string, resourceId?: string, payload?: unknown, ipHash?: string): Promise<void>;
}
