import { hashPassword, verifyPassword } from "./AdminSecurity";
import type { PasswordHasher } from "../application/PasswordHasher";

const UNKNOWN_ACCOUNT_DUMMY_HASH="pbkdf2-sha256$100000$YWRtaW4tYXV0aC1kdW1teS12MQ==$tGNg2tVRJmixbNAmRjz8qyH8LrlC7YDPLs/SFN1eU6g=";

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
