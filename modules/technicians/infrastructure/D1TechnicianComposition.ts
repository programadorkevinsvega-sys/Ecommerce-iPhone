import { D1TechnicianRepository } from "./D1TechnicianRepository";
import { D1TechnicianPasswordHasher } from "./D1TechnicianPasswordHasher";
import { D1TechnicianSessionRepository } from "./D1TechnicianSessionRepository";
import { D1TechnicianTokenHasher } from "./D1TechnicianTokenHasher";
import { TechnicianAuthService } from "../application/TechnicianAuthService";
import { TechnicianManagement } from "../application/TechnicianManagement";

export function technicianAuthApplication(env: CloudflareEnv) {
  const users = new D1TechnicianRepository(env.DB);
  const sessions = new D1TechnicianSessionRepository(env.DB);
  return new TechnicianAuthService(users, sessions, new D1TechnicianPasswordHasher(), new D1TechnicianTokenHasher());
}

export function technicianManagementApplication(env: CloudflareEnv) {
  const users = new D1TechnicianRepository(env.DB);
  return new TechnicianManagement(users, new D1TechnicianPasswordHasher(), new D1TechnicianSessionRepository(env.DB));
}
