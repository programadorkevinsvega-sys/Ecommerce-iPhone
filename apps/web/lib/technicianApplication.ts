import { RepairEvidenceService } from "../../../modules/repairs/application/RepairEvidence";
import { RepairOrderManagement } from "../../../modules/repairs/application/RepairOrderManagement";
import { TechnicianDeviceService } from "../../../modules/technicians/application/TechnicianDeviceService";
import { D1CustomerDeviceRepository } from "../../../modules/customers/infrastructure/D1CustomerDeviceRepository";
import { D1RepairEvidenceRepository } from "../../../modules/repairs/infrastructure/D1RepairEvidenceRepository";
import { D1RepairOrderRepository } from "../../../modules/repairs/infrastructure/D1RepairOrderRepository";
import { R2RepairEvidenceStorage } from "../../../modules/repairs/infrastructure/R2RepairEvidenceStorage";
import { D1TechnicianRepository } from "../../../modules/technicians/infrastructure/D1TechnicianRepository";

export function technicianDeviceApplication(env: CloudflareEnv) {
  return new TechnicianDeviceService(
    new D1CustomerDeviceRepository(env.DB),
    new D1RepairOrderRepository(env.DB),
    new D1TechnicianRepository(env.DB),
  );
}

export function technicianRepairOrderApplication(env: CloudflareEnv) {
  return new RepairOrderManagement(new D1RepairOrderRepository(env.DB));
}

export function technicianRepairEvidenceApplication(env: CloudflareEnv) {
  return new RepairEvidenceService(
    new D1RepairEvidenceRepository(env.DB),
    new R2RepairEvidenceStorage(env.MEDIA_BUCKET),
  );
}
