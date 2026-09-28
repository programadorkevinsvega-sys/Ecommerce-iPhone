import type { D1Database } from "@cloudflare/workers-types";
import type {
  AdminResourceRepository,
  MutationOrder,
  MutationService,
  ProductCreation,
  StatusTransitionValidator,
} from "../application/AdminResourceRepository";
import type { ResourceName } from "../application/AdminResources";

type Db = D1Database;
const like = (query: string) => `%${query}%`;

export class D1AdminResourceRepository implements AdminResourceRepository {
  constructor(
    private readonly db: Db,
    private readonly validateOrderTransition: StatusTransitionValidator,
    private readonly validateServiceTransition: StatusTransitionValidator,
  ) {}

  async list(resource: ResourceName, query: string): Promise<unknown[]> {
    const pattern = like(query);
    if (resource === "products") {
      return (
        await this.db
          .prepare(
            "SELECT p.*, (SELECT COUNT(*) FROM product_images i WHERE i.product_id=p.id) AS image_count, COALESCE((SELECT json_group_array(i.url) FROM product_images i WHERE i.product_id=p.id ORDER BY i.sort_order), '[]') AS image_urls FROM products p WHERE (?='' OR p.id LIKE ? OR p.name LIKE ? OR p.slug LIKE ? OR p.brand LIKE ?) ORDER BY p.created_at DESC LIMIT 100",
          )
          .bind(query, pattern, pattern, pattern, pattern)
          .all()
      ).results;
    }
    if (resource === "customers") {
      return (
        await this.db
          .prepare(
            "SELECT id,email,first_name,last_name,phone,created_at,updated_at FROM customers WHERE (?='' OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?) ORDER BY created_at DESC LIMIT 100",
          )
          .bind(query, pattern, pattern, pattern)
          .all()
      ).results;
    }
    if (resource === "services") {
      return (
        await this.db
          .prepare(
            "SELECT id,customer_id,email,type,service_type_code,device_brand,device_model,imei_last4,device_serial_last4,carrier,problem_description,status,quote_in_cents,currency,assigned_technician_id,created_at,updated_at FROM service_requests WHERE (?='' OR email LIKE ? OR device_brand LIKE ? OR device_model LIKE ? OR status LIKE ?) ORDER BY created_at ASC LIMIT 100",
          )
          .bind(query, pattern, pattern, pattern, pattern)
          .all()
      ).results;
    }
    return (
      await this.db
        .prepare(
          "SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS item_count FROM orders o WHERE (?='' OR o.order_number LIKE ? OR o.email LIKE ? OR o.status LIKE ?) ORDER BY o.created_at DESC LIMIT 100",
        )
        .bind(query, pattern, pattern, pattern)
        .all()
    ).results;
  }

  async createProduct(product: ProductCreation): Promise<string> {
    await this.db
      .prepare(
        "INSERT INTO products (id,name,slug,brand,model,description,condition,price_in_cents,currency,stock,active,warranty_months,battery_health,storage_gb,color,specs_json) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)",
      )
      .bind(
        product.id,
        product.name,
        product.slug,
        product.brand,
        product.model,
        product.description,
        product.condition,
        product.priceInCents,
        "COP",
        product.stock,
        product.warrantyMonths,
        product.batteryHealth,
        product.storageGb,
        product.color,
        product.specsJson,
      )
      .run();
    return product.id;
  }

  async updateProduct(id: string, fields: string[], values: unknown[]): Promise<void> {
    const assignments = fields.map((field) => `${field}=?`).join(",");
    const result = await this.db
      .prepare(`UPDATE products SET ${assignments},updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(...values, id)
      .run();
    if (result.meta.changes !== 1) throw new Error("PRODUCT_NOT_FOUND");
  }

  async getProductCategoryIds(productId: string): Promise<string[]> {
    const product = await this.db
      .prepare("SELECT id FROM products WHERE id=? LIMIT 1")
      .bind(productId)
      .first<{ id: string }>();
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const rows = await this.db
      .prepare(
        "SELECT category_id FROM product_categories WHERE product_id=? ORDER BY category_id ASC",
      )
      .bind(productId)
      .all<{ category_id: string }>();
    return rows.results.map((row) => row.category_id);
  }

  async replaceProductCategories(productId: string, categoryIds: readonly string[]): Promise<void> {
    const product = await this.db
      .prepare("SELECT id FROM products WHERE id=? LIMIT 1")
      .bind(productId)
      .first<{ id: string }>();
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length > 0) {
      const placeholders = uniqueIds.map(() => "?").join(",");
      const rows = await this.db
        .prepare(`SELECT id FROM categories WHERE active=1 AND id IN (${placeholders})`)
        .bind(...uniqueIds)
        .all<{ id: string }>();
      const validIds = new Set(rows.results.map((row) => row.id));
      if (validIds.size !== uniqueIds.length) throw new Error("INVALID_PRODUCT_CATEGORIES");
    }

    const statements = [
      this.db.prepare("DELETE FROM product_categories WHERE product_id=?").bind(productId),
    ];
    statements.push(
      ...uniqueIds.map((categoryId) =>
        this.db
          .prepare("INSERT INTO product_categories (product_id,category_id) VALUES (?,?)")
          .bind(productId, categoryId),
      ),
    );
    await this.db.batch(statements);
  }

  async replaceProductImages(productId: string, imageUrls: readonly string[]): Promise<void> {
    const product = await this.db
      .prepare("SELECT id FROM products WHERE id=? LIMIT 1")
      .bind(productId)
      .first<{ id: string }>();
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const statements = [
      this.db.prepare("DELETE FROM product_images WHERE product_id=?").bind(productId),
    ];
    statements.push(
      ...imageUrls.map((url, index) =>
        this.db
          .prepare(
            "INSERT INTO product_images (id,product_id,url,alt_text,sort_order) VALUES (?,?,?,?,?)",
          )
          .bind(crypto.randomUUID(), productId, url, "Imagen del producto", index),
      ),
    );
    await this.db.batch(statements);
  }

  async getServiceForMutation(id: string): Promise<MutationService | null> {
    return this.db
      .prepare("SELECT status,email FROM service_requests WHERE id=?")
      .bind(id)
      .first<MutationService>();
  }

  async quoteService(id: string, amountInCents: number, actorId: string): Promise<void> {
    const result = await this.db.batch([
      this.db
        .prepare(
          "UPDATE service_requests SET quote_in_cents=?,status='QUOTED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PENDING'",
        )
        .bind(amountInCents, id),
      this.db
        .prepare(
          "INSERT INTO service_audit_events (id,service_request_id,event_type,payload_json) SELECT ?,?,?,? WHERE changes()=1",
        )
        .bind(
          crypto.randomUUID(),
          id,
          "AdminServiceQuoted",
          JSON.stringify({ amountInCents, adminId: actorId }),
        ),
    ]);
    if (result[0]?.meta.changes !== 1) throw new Error("INVALID_SERVICE_TRANSITION");
  }

  async updateServiceStatus(
    id: string,
    status: string,
    actorId: string,
    fromStatus: string,
  ): Promise<void> {
    if (fromStatus === status) throw new Error("SERVICE_NOOP_TRANSITION");
    this.validateServiceTransition(fromStatus, status);
    const result = await this.db.batch([
      this.db
        .prepare(
          "UPDATE service_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?",
        )
        .bind(status, id, fromStatus),
      this.db
        .prepare(
          "INSERT INTO service_audit_events (id,service_request_id,event_type,payload_json) SELECT ?,?,?,? WHERE changes()=1",
        )
        .bind(
          crypto.randomUUID(),
          id,
          "AdminServiceStatusChanged",
          JSON.stringify({ from: fromStatus, to: status, adminId: actorId }),
        ),
    ]);
    if (result[0]?.meta.changes !== 1) throw new Error("SERVICE_STATUS_CONFLICT");
  }

  async getOrderForMutation(id: string): Promise<MutationOrder | null> {
    return this.db
      .prepare("SELECT status,email,order_number AS orderNumber FROM orders WHERE id=?")
      .bind(id)
      .first<MutationOrder>();
  }

  async updateOrderStatus(
    id: string,
    status: string,
    actorId: string,
    fromStatus: string,
  ): Promise<void> {
    if (fromStatus === status) throw new Error("ORDER_NOOP_TRANSITION");
    this.validateOrderTransition(fromStatus, status);
    const result = await this.db.batch([
      this.db
        .prepare("UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=?")
        .bind(status, id, fromStatus),
      this.db
        .prepare(
          "INSERT INTO order_events (id,order_id,event_type,payload_json) SELECT ?,?,?,? WHERE changes()=1",
        )
        .bind(
          crypto.randomUUID(),
          id,
          "AdminOrderStatusChanged",
          JSON.stringify({ from: fromStatus, to: status, adminId: actorId }),
        ),
    ]);
    if (result[0]?.meta.changes !== 1) throw new Error("ORDER_STATUS_CONFLICT");
  }
}
