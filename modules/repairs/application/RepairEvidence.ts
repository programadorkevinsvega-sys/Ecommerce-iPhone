import { DomainError } from "../../shared-kernel";

export type RepairMediaStage = "RECEPTION" | "DIAGNOSIS" | "REPAIR" | "QUALITY_CONTROL";
export type RepairMedia = Readonly<{
  id: string;
  repairOrderId: string;
  stage: RepairMediaStage;
  url: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}>;

export interface RepairEvidenceRepository {
  add(media: RepairMedia): Promise<void>;
  list(repairOrderId: string): Promise<readonly RepairMedia[]>;
}

export interface RepairEvidenceStorage {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class RepairEvidenceService {
  constructor(
    private readonly evidence: RepairEvidenceRepository,
    private readonly storage?: RepairEvidenceStorage,
  ) {}

  async add(input: Omit<RepairMedia, "id">) {
    if (!input.repairOrderId || !input.uploadedBy || !input.url || input.sizeBytes < 1) {
      throw new DomainError("INVALID_REPAIR_MEDIA");
    }
    const media = { ...input, id: crypto.randomUUID() };
    await this.evidence.add(media);
    return media;
  }

  async upload(input: {
    repairOrderId: string;
    stage: RepairMediaStage;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    data: ArrayBuffer;
  }) {
    if (!this.storage) throw new DomainError("REPAIR_MEDIA_STORAGE_UNAVAILABLE");

    const extension = extensions[input.mimeType];
    if (!extension || input.sizeBytes < 1 || input.sizeBytes > 5 * 1024 * 1024) {
      throw new DomainError("INVALID_REPAIR_MEDIA");
    }

    const key = "repair-evidence/" + input.repairOrderId + "/" + crypto.randomUUID() + "." + extension;
    await this.storage.put(key, input.data, input.mimeType);

    try {
      return await this.add({
        repairOrderId: input.repairOrderId,
        stage: input.stage,
        url: "/api/media/" + key,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        uploadedBy: input.uploadedBy,
      });
    } catch (error) {
      await this.storage.delete(key).catch(() => undefined);
      throw error;
    }
  }

  list(repairOrderId: string) {
    return this.evidence.list(repairOrderId);
  }
}
