import { DomainError } from "../../shared-kernel";
export type RepairMediaStage = "RECEPTION" | "DIAGNOSIS" | "REPAIR" | "QUALITY_CONTROL";
export type RepairMedia = Readonly<{ id: string; repairOrderId: string; stage: RepairMediaStage; url: string; mimeType: string; sizeBytes: number; uploadedBy: string }>;
export interface RepairEvidenceRepository { add(media: RepairMedia): Promise<void>; list(repairOrderId: string): Promise<readonly RepairMedia[]>; }
export class RepairEvidenceService {
  constructor(private readonly evidence: RepairEvidenceRepository) {}
  async add(input: Omit<RepairMedia, "id">) { if (!input.repairOrderId || !input.uploadedBy || !input.url || input.sizeBytes < 1) throw new DomainError("INVALID_REPAIR_MEDIA"); const media = { ...input, id: crypto.randomUUID() }; await this.evidence.add(media); return media; }
  list(repairOrderId: string) { return this.evidence.list(repairOrderId); }
}
