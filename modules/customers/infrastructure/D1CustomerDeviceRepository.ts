import type { D1Database } from "@cloudflare/workers-types";
import { CustomerDevice, type CustomerDeviceProps } from "../domain/CustomerDevice";
import type { CustomerDeviceRepository, CustomerDeviceEventType } from "../application/CustomerDeviceRepository";

export class D1CustomerDeviceRepository implements CustomerDeviceRepository {
  constructor(private readonly db: D1Database) {}

  private hydrate(row: any): CustomerDevice {
    return CustomerDevice.create(String(row.id), {
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
    });
  }

  async list(customerId: string): Promise<readonly CustomerDevice[]> {
    const rows = await this.db.prepare(
      "SELECT id,customer_id,device_type,brand,model,serial_last4,imei_last4,color,capacity,physical_condition,notes FROM customer_devices WHERE customer_id=? AND archived_at IS NULL ORDER BY created_at DESC",
    ).bind(customerId).all<any>();
    return rows.results.map(row => this.hydrate(row));
  }

  async find(customerId: string, id: string): Promise<CustomerDevice | null> {
    const row = await this.db.prepare(
      "SELECT id,customer_id,device_type,brand,model,serial_last4,imei_last4,color,capacity,physical_condition,notes FROM customer_devices WHERE id=? AND customer_id=? AND archived_at IS NULL LIMIT 1",
    ).bind(id, customerId).first<any>();
    return row ? this.hydrate(row) : null;
  }

  async create(props: CustomerDeviceProps): Promise<CustomerDevice> {
    const id = crypto.randomUUID();
    await this.db.prepare(
      "INSERT INTO customer_devices(id,customer_id,brand,model,serial_last4,imei_last4,color,notes,device_type,capacity,physical_condition) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(id, props.customerId, props.brand, props.model, props.serialLast4, props.imeiLast4, props.color, props.notes, props.deviceType, props.capacity, props.physicalCondition).run();
    const created = await this.find(props.customerId, id);
    if (!created) throw new Error("DEVICE_CREATE_FAILED");
    return created;
  }

  async update(customerId: string, id: string, props: CustomerDeviceProps): Promise<CustomerDevice | null> {
    await this.db.prepare(
      "UPDATE customer_devices SET brand=?,model=?,serial_last4=?,imei_last4=?,color=?,notes=?,device_type=?,capacity=?,physical_condition=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? AND archived_at IS NULL",
    ).bind(props.brand, props.model, props.serialLast4, props.imeiLast4, props.color, props.notes, props.deviceType, props.capacity, props.physicalCondition, id, customerId).run();
    return this.find(customerId, id);
  }

  async archive(customerId: string, id: string): Promise<boolean> {
    const result = await this.db.prepare(
      "UPDATE customer_devices SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? AND archived_at IS NULL",
    ).bind(id, customerId).run();
    return result.meta.changes === 1;
  }

  async recordEvent(customerId: string, deviceId: string, eventType: CustomerDeviceEventType, metadata?: Record<string, unknown>): Promise<void> {
    await this.db.prepare(
      "INSERT INTO customer_device_events(id,customer_device_id,customer_id,event_type,metadata_json) VALUES(?,?,?,?,?)",
    ).bind(crypto.randomUUID(), deviceId, customerId, eventType, metadata ? JSON.stringify(metadata) : null).run();
  }
}
