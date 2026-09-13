import type { AdminUser } from "../domain/AdminUser";

export interface AdminRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  save(user: AdminUser): Promise<void>;
}
