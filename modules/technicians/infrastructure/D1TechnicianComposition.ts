import { D1CustomerDeviceRepository } from "../../customers/infrastructure/D1CustomerDeviceRepository";
import { D1RepairOrderRepository } from "../../repairs/infrastructure/D1RepairOrderRepository";
import { D1TechnicianRepository } from "./D1TechnicianRepository";
import { D1TechnicianPasswordHasher } from "./D1TechnicianPasswordHasher";
import { D1TechnicianSessionRepository } from "./D1TechnicianSessionRepository";
import { TechnicianAuthService } from "../application/TechnicianAuthService";
import { TechnicianDeviceService } from "../application/TechnicianDeviceService";
import { TechnicianManagement } from "../application/TechnicianManagement";

export function technicianAuthApplication(env: CloudflareEnv) {
  const users = new D1TechnicianRepository(env.DB);
  const sessions = new D1TechnicianSessionRepository(env.DB);
  return new TechnicianAuthService(users, sessions, new D1TechnicianPasswordHasher());
}

export function technicianManagementApplication(env: CloudflareEnv) {
  const users = new D1TechnicianRepository(env.DB);
  return new TechnicianManagement(users, new D1TechnicianPasswordHasher(), new D1TechnicianSessionRepository(env.DB));
}

export function technicianDeviceApplication(env: CloudflareEnv) {
  const technicians = new D1TechnicianRepository(env.DB);
  return new TechnicianDeviceService(
    new D1CustomerDeviceRepository(env.DB),
    new D1RepairOrderRepository(env.DB),
    technicians,
  );
}
