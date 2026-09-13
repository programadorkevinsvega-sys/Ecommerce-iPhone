import { hashPassword } from "./AdminSecurity";
import type { PasswordHasher } from "../application/AdminUserManagement";

export class D1AdminPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }
}
