import {
  hashTechnicianPassword,
  TECHNICIAN_UNKNOWN_ACCOUNT_DUMMY_HASH,
  verifyTechnicianPassword,
} from "./TechnicianSecurity";
import type { TechnicianPasswordHasher } from "../application/TechnicianPasswordHasher";

export class D1TechnicianPasswordHasher implements TechnicianPasswordHasher {
  hash(password: string) {
    return hashTechnicianPassword(password);
  }

  verify(password: string, passwordHash: string) {
    return verifyTechnicianPassword(password, passwordHash);
  }

  verifyUnknownAccount(password: string) {
    return verifyTechnicianPassword(password, TECHNICIAN_UNKNOWN_ACCOUNT_DUMMY_HASH).then(() => undefined);
  }
}
