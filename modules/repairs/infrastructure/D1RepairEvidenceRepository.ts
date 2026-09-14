import type { D1Database } from "@cloudflare/workers-types";
import type { RepairEvidenceRepository, RepairMedia } from "../application/RepairEvidence";
export class D1RepairEvidenceRepository implements RepairEvidenceRepository {
  constructor(private readonly db: D1Database) {}
  async add(media: RepairMedia) { await this.db.prepare("INSERT INTO repair_order_media (id,repair_order_id,stage,url,mime_type,size_bytes,uploaded_by) VALUES (?,?,?,?,?,?,?)").bind(media.id, media.repairOrderId, media.stage, media.url, media.mimeType, media.sizeBytes, media.uploadedBy).run(); }
  async list(repairOrderId: string) { const rows = await this.db.prepare("SELECT id,repair_order_id,stage,url,mime_type,size_bytes,uploaded_by FROM repair_order_media WHERE repair_order_id=? ORDER BY created_at DESC").bind(repairOrderId).all<{id:string;repair_order_id:string;stage:RepairMedia["stage"];url:string;mime_type:string;size_bytes:number;uploaded_by:string}>(); return rows.results.map((row) => ({ id:row.id, repairOrderId:row.repair_order_id, stage:row.stage, url:row.url, mimeType:row.mime_type, sizeBytes:row.size_bytes, uploadedBy:row.uploaded_by })); }
}
