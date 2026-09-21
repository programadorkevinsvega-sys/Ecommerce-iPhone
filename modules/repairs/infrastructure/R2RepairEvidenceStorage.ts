import type { R2Bucket } from "@cloudflare/workers-types";
import type { RepairEvidenceStorage } from "../application/RepairEvidence";

export class R2RepairEvidenceStorage implements RepairEvidenceStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, data: ArrayBuffer, contentType: string) {
    await this.bucket.put(key, data, {
      httpMetadata: { contentType },
    });
  }

  async delete(key: string) {
    await this.bucket.delete(key);
  }
}
