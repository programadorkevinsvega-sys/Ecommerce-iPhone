import { sha256Technician } from "./TechnicianSecurity";
import type { TechnicianTokenHasher } from "../application/TechnicianTokenHasher";

export class D1TechnicianTokenHasher implements TechnicianTokenHasher {
  hash(token: string) {
    return sha256Technician(token);
  }
}
