import { sha256 } from "../../admin/infrastructure/AdminSecurity";
import type { TechnicianTokenHasher } from "../application/TechnicianTokenHasher";

export class D1TechnicianTokenHasher implements TechnicianTokenHasher {
  hash(token: string) {
    return sha256(token);
  }
}
