import { D1CustomerDeviceRepository } from "../../customers/infrastructure/D1CustomerDeviceRepository";
import { D1RepairOrderRepository } from "../../repairs/infrastructure/D1RepairOrderRepository";
import { D1TechnicianPasswordHasher } from "./D1TechnicianPasswordHasher";
import { D1TechnicianRepository } from "./D1TechnicianRepository";
import { D1TechnicianSessionRepository } from "./D1TechnicianSessionRepository";
import { TechnicianAuthService } from "../application/TechnicianAuthService";
import { TechnicianManagement } from "../application/TechnicianManagement";
import { TechnicianDeviceService } from "../application/TechnicianDeviceService";
export function technicianAuthApplication(env:CloudflareEnv){const users=new D1TechnicianRepository(env.DB);const sessions=new D1TechnicianSessionRepository(env.DB);return new TechnicianAuthService(users,sessions,new D1TechnicianPasswordHasher());}
export function technicianManagementApplication(env:CloudflareEnv){return new TechnicianManagement(new D1TechnicianRepository(env.DB),new D1TechnicianPasswordHasher(),new D1TechnicianSessionRepository(env.DB));}
export function technicianDeviceApplication(env:CloudflareEnv){return new TechnicianDeviceService(new D1CustomerDeviceRepository(env.DB),new D1RepairOrderRepository(env.DB));}
