import type { D1Database } from "@cloudflare/workers-types";
import type { RepairOrderListQuery, RepairOrderRepository } from "../application/RepairOrderRepository";
import { RepairOrder, type DeviceCondition, type RepairOrderStatus } from "../domain/RepairOrder";

type Row = { id: string; order_number: string; public_token: string | null; service_request_id: string | null; customer_id: string | null; customer_device_id: string | null; email: string; status: RepairOrderStatus; problem_reported: string; diagnosis_summary: string | null; work_summary: string | null; assigned_technician_id: string | null; received_at: string; estimated_completion_at: string | null; delivered_at: string | null; created_at: string; updated_at: string; device_id: string; brand: string; model: string; serial_last4: string | null; imei_last4: string | null; color: string | null; storage_gb: number | null; battery_health: number | null };
type ConditionRow = { component: string; condition: DeviceCondition; notes: string | null };

export class D1RepairOrderRepository implements RepairOrderRepository {
  constructor(private readonly db: D1Database) {}

  async save(order: RepairOrder, actorId: string | null): Promise<void> {
    const p = order.toPrimitives();
    const d = p.device;
    const previous = await this.db.prepare("SELECT status FROM repair_orders WHERE id=?").bind(p.id).first<{ status: RepairOrderStatus }>();
    const statements = [
      this.db.prepare("INSERT INTO repair_orders (id,order_number,public_token,service_request_id,customer_id,customer_device_id,email,status,problem_reported,diagnosis_summary,work_summary,assigned_technician_id,received_at,estimated_completion_at,delivered_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET public_token=excluded.public_token,customer_device_id=excluded.customer_device_id,status=excluded.status,diagnosis_summary=excluded.diagnosis_summary,work_summary=excluded.work_summary,assigned_technician_id=excluded.assigned_technician_id,estimated_completion_at=excluded.estimated_completion_at,delivered_at=excluded.delivered_at,updated_at=excluded.updated_at").bind(p.id, p.orderNumber, p.publicToken ?? null, p.serviceRequestId ?? null, p.customerId ?? null, p.customerDeviceId ?? null, p.email, p.status, p.problemReported, p.diagnosisSummary ?? null, p.workSummary ?? null, p.assignedTechnicianId ?? null, p.receivedAt, p.estimatedCompletionAt ?? null, p.deliveredAt ?? null, p.createdAt, p.updatedAt),
      this.db.prepare("INSERT INTO repair_device_sheets (id,repair_order_id,brand,model,serial_last4,imei_last4,color,storage_gb,battery_health,updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(repair_order_id) DO UPDATE SET brand=excluded.brand,model=excluded.model,serial_last4=excluded.serial_last4,imei_last4=excluded.imei_last4,color=excluded.color,storage_gb=excluded.storage_gb,battery_health=excluded.battery_health,updated_at=CURRENT_TIMESTAMP").bind(d.id, p.id, d.brand, d.model, d.serialLast4 ?? null, d.imeiLast4 ?? null, d.color ?? null, d.storageGb ?? null, d.batteryHealth ?? null),
      this.db.prepare("DELETE FROM repair_device_condition_items WHERE device_sheet_id=?").bind(d.id),
    ];
    for (const item of d.conditions) statements.push(this.db.prepare("INSERT INTO repair_device_condition_items (id,device_sheet_id,component,condition,notes) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), d.id, item.component, item.condition, item.notes ?? null));
    if (!previous || previous.status !== p.status) {
      statements.push(this.db.prepare("INSERT INTO repair_order_status_history (id,repair_order_id,from_status,to_status,actor_id) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(), p.id, previous?.status ?? null, p.status, actorId));
      const eventId = crypto.randomUUID();
      statements.push(this.db.prepare("INSERT OR IGNORE INTO notification_outbox (id,event_key,event_type,aggregate_id,payload_json,created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)").bind(eventId, `ServiceStatusChanged:${p.id}:${eventId}`, "ServiceStatusChanged", p.id, JSON.stringify({ email: p.email, serviceId: p.orderNumber, status: p.status })));
    }
    await this.db.batch(statements);
  }

  async findById(id: string) { return this.find("WHERE r.id=?", [id]); }
  async findByServiceRequestId(id: string) { return this.find("WHERE r.service_request_id=?", [id]); }
  async findByPublicToken(token: string) { return this.find("WHERE r.public_token=?", [token]); }

  async list(query: RepairOrderListQuery) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (query.status) { where.push("r.status=?"); values.push(query.status); }
    if (query.customerId) { where.push("r.customer_id=?"); values.push(query.customerId); }
    if (query.technicianId) { where.push("r.assigned_technician_id=?"); values.push(query.technicianId); }
    const rows = await this.db.prepare(`SELECT r.*,d.id AS device_id,d.brand,d.model,d.serial_last4,d.imei_last4,d.color,d.storage_gb,d.battery_health FROM repair_orders r JOIN repair_device_sheets d ON d.repair_order_id=r.id ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC LIMIT ?`).bind(...values, Math.min(Math.max(query.limit ?? 50, 1), 100)).all<Row>();
    return Promise.all(rows.results.map((row) => this.hydrate(row)));
  }

  private async find(predicate: string, values: unknown[]) {
    const row = await this.db.prepare(`SELECT r.*,d.id AS device_id,d.brand,d.model,d.serial_last4,d.imei_last4,d.color,d.storage_gb,d.battery_health FROM repair_orders r JOIN repair_device_sheets d ON d.repair_order_id=r.id ${predicate} LIMIT 1`).bind(...values).first<Row>();
    return row ? this.hydrate(row) : null;
  }

  private async hydrate(row: Row) {
    const conditions = await this.db.prepare("SELECT component,condition,notes FROM repair_device_condition_items WHERE device_sheet_id=? ORDER BY created_at ASC").bind(row.device_id).all<ConditionRow>();
    return RepairOrder.create({
      id: row.id,
      orderNumber: row.order_number,
      ...(row.public_token ? { publicToken: row.public_token } : {}),
      ...(row.service_request_id ? { serviceRequestId: row.service_request_id } : {}),
      ...(row.customer_id ? { customerId: row.customer_id } : {}), ...(row.customer_device_id ? { customerDeviceId: row.customer_device_id } : {}),
      email: row.email,
      status: row.status,
      problemReported: row.problem_reported,
      ...(row.diagnosis_summary ? { diagnosisSummary: row.diagnosis_summary } : {}),
      ...(row.work_summary ? { workSummary: row.work_summary } : {}),
      ...(row.assigned_technician_id ? { assignedTechnicianId: row.assigned_technician_id } : {}),
      receivedAt: row.received_at,
      ...(row.estimated_completion_at ? { estimatedCompletionAt: row.estimated_completion_at } : {}),
      ...(row.delivered_at ? { deliveredAt: row.delivered_at } : {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      device: { id: row.device_id, brand: row.brand, model: row.model, ...(row.serial_last4 ? { serialLast4: row.serial_last4 } : {}), ...(row.imei_last4 ? { imeiLast4: row.imei_last4 } : {}), ...(row.color ? { color: row.color } : {}), ...(row.storage_gb !== null ? { storageGb: Number(row.storage_gb) } : {}), ...(row.battery_health !== null ? { batteryHealth: Number(row.battery_health) } : {}), conditions: conditions.results.map((item) => ({ component: item.component, condition: item.condition, ...(item.notes ? { notes: item.notes } : {}) })) },
    });
  }
}
