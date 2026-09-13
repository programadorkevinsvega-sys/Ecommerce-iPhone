import { hashPassword, verifyPassword } from "./AdminSecurity";
import type { PasswordHasher } from "../application/PasswordHasher";

const UNKNOWN_ACCOUNT_DUMMY_HASH="pbkdf2-sha256$150000$YWRtaW4tYXV0aC1kdW1teS12MQ==$BxVFNefctIB65jZqgaIJufOloJXrT0JAEjd2G1I4q5I=";

export class D1AdminAuthPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return verifyPassword(password, passwordHash);
  }

  async verifyUnknownAccount(password: string): Promise<void> {
    await verifyPassword(password, UNKNOWN_ACCOUNT_DUMMY_HASH);
  }
}
