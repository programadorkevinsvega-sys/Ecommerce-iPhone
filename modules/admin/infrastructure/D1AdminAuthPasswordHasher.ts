import { hashPassword, verifyPassword } from "./AdminSecurity";
import type { PasswordHasher } from "../application/PasswordHasher";

export class D1AdminAuthPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return verifyPassword(password, passwordHash);
  }
}
