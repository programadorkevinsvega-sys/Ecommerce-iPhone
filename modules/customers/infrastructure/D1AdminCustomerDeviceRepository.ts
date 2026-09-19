import type { D1Database } from "@cloudflare/workers-types";
import { CustomerDevice, type CustomerDeviceProps } from "../domain/CustomerDevice";
import type { AdminCustomerDevice, AdminCustomerDeviceRepository } from "../application/AdminCustomerDeviceRepository";

export class D1AdminCustomerDeviceRepository implements AdminCustomerDeviceRepository {
  constructor(private readonly db: D1Database) {}

  private hydrate(row: any): CustomerDevice {
    return CustomerDevice.create(String(row.id), {
      customerId: String(row.customer_id), deviceType: String(row.device_type), brand: String(row.brand),
      model: String(row.model), serialLast4: row.serial_last4 ? String(row.serial_last4) : null,
      imeiLast4: row.imei_last4 ? String(row.imei_last4) : null, color: row.color ? String(row.color) : null,
      capacity: row.capacity ? String(row.capacity) : null, physicalCondition: row.physical_condition ? String(row.physical_condition) : null,
      notes: row.notes ? String(row.notes) : null,
    });
  }

  async list(query: string): Promise<readonly AdminCustomerDevice[]> {
    const pattern = query ? `%\${query.replace(/[%_]/gu, "\\$&")}%` : "%";
    const rows = await this.db.prepare(
      "SELECT d.id,d.customer_id,d.device_type,d.brand,d.model,d.serial_last4,d.imei_last4,d.color,d.capacity,d.physical_condition,d.notes,d.created_at,d.updated_at,d.archived_at,c.first_name,c.last_name,c.email FROM customer_devices d JOIN customers c ON c.id=d.customer_id WHERE d.brand LIKE ? ESCAPE '\\' OR d.model LIKE ? ESCAPE '\\' OR c.first_name LIKE ? ESCAPE '\\' OR c.last_name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' ORDER BY d.created_at DESC LIMIT 200",
    ).bind(pattern, pattern, pattern, pattern, pattern).all<any>();
    return rows.results.map(row => ({ ...this.hydrate(row).toPrimitives(), createdAt: String(row.created_at), updatedAt: String(row.updated_at), archivedAt: row.archived_at ? String(row.archived_at) : null, customerName: [row.first_name, row.last_name].filter(Boolean).join(" "), customerEmail: String(row.email) }));
  }

  async find(id: string): Promise<CustomerDevice | null> {
    const row = await this.db.prepare("SELECT id,customer_id,device_type,brand,model,serial_last4,imei_last4,color,capacity,physical_condition,notes FROM customer_devices WHERE id=? LIMIT 1").bind(id).first<any>();
    return row ? this.hydrate(row) : null;
  }

  async create(device: CustomerDevice): Promise<CustomerDevice> {
    const p = device.toPrimitives();
    await this.db.prepare("INSERT INTO customer_devices(id,customer_id,brand,model,serial_last4,imei_last4,color,notes,device_type,capacity,physical_condition) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(device.getId(),p.customerId,p.brand,p.model,p.serialLast4,p.imeiLast4,p.color,p.notes,p.deviceType,p.capacity,p.physicalCondition).run();
    const created = await this.find(device.getId());
    if (!created) throw new Error("DEVICE_CREATE_FAILED");
    return created;
  }

  async update(id: string, p: CustomerDeviceProps): Promise<CustomerDevice | null> {
    await this.db.prepare("UPDATE customer_devices SET brand=?,model=?,serial_last4=?,imei_last4=?,color=?,notes=?,device_type=?,capacity=?,physical_condition=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? AND archived_at IS NULL").bind(p.brand,p.model,p.serialLast4,p.imeiLast4,p.color,p.notes,p.deviceType,p.capacity,p.physicalCondition,id,p.customerId).run();
    return this.find(id);
  }

  async archive(id: string): Promise<boolean> {
    const result = await this.db.prepare("UPDATE customer_devices SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND archived_at IS NULL").bind(id).run();
    return result.meta.changes === 1;
  }

  async recordEvent(customerId: string, deviceId: string, eventType: "CREATED" | "UPDATED" | "ARCHIVED", metadata?: Record<string, unknown>): Promise<void> {
    await this.db.prepare("INSERT INTO customer_device_events(id,customer_device_id,customer_id,event_type,metadata_json) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),deviceId,customerId,eventType,metadata ? JSON.stringify(metadata) : null).run();
  }
}
