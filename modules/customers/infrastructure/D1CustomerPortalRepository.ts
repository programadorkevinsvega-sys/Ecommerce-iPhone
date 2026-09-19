import type { D1Database } from "@cloudflare/workers-types";
import type { CustomerCommunication, CustomerDevice, CustomerPortalRepository, CustomerRepair, CustomerWarranty } from "../application/CustomerPortalRepository";

export class D1CustomerPortalRepository implements CustomerPortalRepository {
  constructor(private readonly db: D1Database) {}

  private payload(value: unknown): Record<string, unknown> {
    if (typeof value !== "string") return {};
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch { return {}; }
  }

  async listDevices(customerId: string): Promise<readonly CustomerDevice[]> {
    const rows = await this.db.prepare(
      "SELECT id,customer_id,device_type,brand,model,serial_last4,imei_last4,color,capacity,physical_condition,notes,created_at,updated_at FROM customer_devices WHERE customer_id=? AND archived_at IS NULL ORDER BY created_at DESC",
    ).bind(customerId).all<any>();
    return rows.results.map((row): CustomerDevice => ({
      id: String(row.id),
      customerId: String(row.customer_id),
      deviceType: String(row.device_type),
      brand: String(row.brand),
      model: String(row.model),
      serialLast4: row.serial_last4 ? String(row.serial_last4) : null,
      imeiLast4: row.imei_last4 ? String(row.imei_last4) : null,
      color: row.color ? String(row.color) : null,
      capacity: row.capacity ? String(row.capacity) : null,
      physicalCondition: row.physical_condition ? String(row.physical_condition) : null,
      notes: row.notes ? String(row.notes) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }));
  }

  async listRepairs(customerId:string) {
    const rows=await this.db.prepare("SELECT r.id,r.order_number,r.status,r.problem_reported,r.diagnosis_summary,r.work_summary,r.received_at,r.estimated_completion_at,d.brand,d.model,d.serial_last4,d.imei_last4,d.color FROM repair_orders r JOIN repair_device_sheets d ON d.repair_order_id=r.id WHERE r.customer_id=? ORDER BY r.created_at DESC").bind(customerId).all<any>();
    return rows.results.map((row):CustomerRepair=>({id:String(row.id),orderNumber:String(row.order_number),status:String(row.status),problemReported:String(row.problem_reported),diagnosisSummary:row.diagnosis_summary?String(row.diagnosis_summary):null,workSummary:row.work_summary?String(row.work_summary):null,receivedAt:String(row.received_at),estimatedCompletionAt:row.estimated_completion_at?String(row.estimated_completion_at):null,device:{brand:String(row.brand),model:String(row.model),serialLast4:row.serial_last4?String(row.serial_last4):null,imeiLast4:row.imei_last4?String(row.imei_last4):null,color:row.color?String(row.color):null}}));
  }

  async listWarranties(customerId:string) {
    const rows=await this.db.prepare("SELECT w.repair_order_id,r.order_number,w.warranty_number,w.coverage,w.months,w.starts_at,w.expires_at,w.status FROM repair_warranties w JOIN repair_orders r ON r.id=w.repair_order_id WHERE r.customer_id=? ORDER BY w.expires_at DESC").bind(customerId).all<any>();
    return rows.results.map((row):CustomerWarranty=>({repairOrderId:String(row.repair_order_id),orderNumber:String(row.order_number),warrantyNumber:String(row.warranty_number),coverage:String(row.coverage),months:Number(row.months),startsAt:String(row.starts_at),expiresAt:String(row.expires_at),status:String(row.status)}));
  }

  async listCommunications(customerId:string) {
    const rows=await this.db.prepare("SELECT n.id,n.event_type,n.aggregate_id,n.payload_json,n.created_at FROM notification_outbox n LEFT JOIN repair_orders r ON r.id=n.aggregate_id LEFT JOIN orders o ON o.id=n.aggregate_id LEFT JOIN service_requests s ON s.id=n.aggregate_id WHERE r.customer_id=? OR o.customer_id=? OR s.customer_id=? ORDER BY n.created_at DESC LIMIT 100").bind(customerId,customerId,customerId).all<any>();
    return rows.results.map((row):CustomerCommunication=>({id:String(row.id),type:String(row.event_type),aggregateId:String(row.aggregate_id),payload:this.payload(row.payload_json),createdAt:String(row.created_at)}));
  }
}
