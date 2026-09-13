import type { D1Database } from "@cloudflare/workers-types";
import type { AdminRepository, LoginFailureState } from "../application/AdminRepository";
import { D1AdminRepository } from "./D1AdminRepository";

export class D1AdminAuthRepository implements AdminRepository {
  private readonly repository: D1AdminRepository;
  constructor(db: D1Database) { this.repository = new D1AdminRepository(db); }
  findByEmail(email: string) { return this.repository.findByEmail(email); }
  findById(id: string) { return this.repository.findById(id); }
  save(user: Parameters<AdminRepository["save"]>[0]) { return this.repository.saveUser(user); }
  createInitialSuperAdmin(user: Parameters<AdminRepository["createInitialSuperAdmin"]>[0]) { return this.repository.createInitialSuperAdmin(user); }
  recordFailedLogin(id: string, now: Date, maxAttempts: number, lockMinutes: number): Promise<LoginFailureState> { return this.repository.recordFailedLogin(id, now, maxAttempts, lockMinutes); }
  recordSuccessfulLogin(id: string, now: Date) { return this.repository.recordSuccessfulLogin(id, now); }
}
