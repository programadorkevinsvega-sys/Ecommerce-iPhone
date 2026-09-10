import type { AdminResourceRepository, MutationOrder, MutationService, ProductCreation } from "../application/AdminResourceRepository";
import type { ResourceName } from "../application/AdminResources";
import type { D1AdminRepository } from "./D1AdminRepository";

type Db = D1Database;

const like = (query: string) => `%${query}%`;

export class D1AdminResourceRepository implements AdminResourceRepository {
  constructor(private readonly db: Db, private readonly adminRepository: D1AdminRepository) {}

  async list(resource: ResourceName, query: string): Promise<unknown[]> {
    const pattern = like(query);
    if (resource === "products") {
      return (await this.db.prepare("SELECT p.*, (SELECT COUNT(*) FROM product_images i WHERE i.product_id=p.id) AS image_count FROM products p WHERE (?='' OR p.name LIKE ? OR p.slug LIKE ? OR p.brand LIKE ?) ORDER BY p.created_at DESC LIMIT 100").bind(query, pattern, pattern, pattern).all()).results;
    }
    if (resource === "customers") {
      return (await this.db.prepare("SELECT id,email,first_name,last_name,phone,created_at,updated_at FROM customers WHERE (?='' OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?) ORDER BY created_at DESC LIMIT 100").bind(query, pattern, pattern, pattern).all()).results;
    }
    if (resource === "services") {
      return (await this.db.prepare("SELECT id,customer_id,email,type,service_type_code,device_brand,device_model,imei_last4,device_serial_last4,carrier,problem_description,status,quote_in_cents,currency,assigned_technician_id,created_at,updated_at FROM service_requests WHERE (?='' OR email LIKE ? OR device_brand LIKE ? OR device_model LIKE ? OR status LIKE ?) ORDER BY created_at ASC LIMIT 100").bind(query, pattern, pattern, pattern, pattern).all()).results;
    }
    return (await this.db.prepare("SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS item_count FROM orders o WHERE (?='' OR o.order_number LIKE ? OR o.email LIKE ? OR o.status LIKE ?) ORDER BY o.created_at DESC LIMIT 100").bind(query, pattern, pattern, pattern).all()).results;
  }

  async createProduct(product: ProductCreation): Promise<string> {
    await this.db.prepare("INSERT INTO products (id,name,slug,brand,model,description,condition,price_in_cents,currency,stock,active,warranty_months,battery_health,storage_gb,color,specs_json) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)")
      .bind(product.id, product.name, product.slug, product.brand, product.model, product.description, product.condition, product.priceInCents, "COP", product.stock, product.warrantyMonths, product.batteryHealth, product.storageGb, product.color, product.specsJson)
      .run();
    return product.id;
  }

  async updateProduct(id: string, fields: string[], values: unknown[]): Promise<void> {
    const assignments = fields.map((field) => `${field}=?`).join(",");
    await this.db.prepare(`UPDATE products SET ${assignments},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, id).run();
  }

  async getServiceForMutation(id: string): Promise<MutationService | null> {
    return this.db.prepare("SELECT status,email FROM service_requests WHERE id=?").bind(id).first<MutationService>();
  }

  async quoteService(id: string, amountInCents: number): Promise<void> {
    await this.db.prepare("UPDATE service_requests SET quote_in_cents=?,status='QUOTED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(amountInCents, id).run();
    await this.db.prepare("INSERT INTO service_audit_events (id,service_request_id,event_type,payload_json) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(), id, "AdminServiceQuoted", JSON.stringify({ amountInCents })).run();
  }

  async updateServiceStatus(id: string, status: string, actorId: string, fromStatus: string): Promise<void> {
    await this.db.prepare("UPDATE service_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, id).run();
    await this.db.prepare("INSERT INTO service_audit_events (id,service_request_id,event_type,payload_json) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(), id, "AdminServiceStatusChanged", JSON.stringify({ from: fromStatus, to: status, adminId: actorId })).run();
  }

  async getOrderForMutation(id: string): Promise<MutationOrder | null> {
    return this.db.prepare("SELECT status,email,order_number AS orderNumber FROM orders WHERE id=?").bind(id).first<MutationOrder>();
  }

  async updateOrderStatus(id: string, status: string, actorId: string, fromStatus: string): Promise<void> {
    await this.db.prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status, id).run();
    await this.db.prepare("INSERT INTO order_events (id,order_id,event_type,payload_json) VALUES (?,?,?,?)")
      .bind(crypto.randomUUID(), id, "AdminOrderStatusChanged", JSON.stringify({ from: fromStatus, to: status, adminId: actorId })).run();
  }

  async audit(actorId: string, action: string, resource: string, resourceId: string, metadata: unknown): Promise<void> {
    await this.adminRepository.audit(actorId, action, resource, resourceId, metadata);
  }
}
