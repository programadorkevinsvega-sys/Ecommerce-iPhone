import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { PERMISSIONS } from "../../../../../../modules/admin/infrastructure/AdminSecurity";

const json = (value: unknown) => JSON.stringify(value);
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "orders";
    const q = clean(url.searchParams.get("q"), 100);
    const { env } = await requireAdmin(resource === "customers" ? PERMISSIONS.customersRead : resource === "services" ? PERMISSIONS.servicesRead : resource === "products" ? PERMISSIONS.productsRead : PERMISSIONS.ordersRead);
    if (resource === "products") {
      const result = await env.DB.prepare("SELECT p.*, (SELECT COUNT(*) FROM product_images i WHERE i.product_id=p.id) AS image_count FROM products p WHERE (?='' OR p.name LIKE ? OR p.slug LIKE ? OR p.brand LIKE ?) ORDER BY p.created_at DESC LIMIT 100").bind(q, `%${q}%`, `%${q}%`, `%${q}%`).all();
      return NextResponse.json({ items: result.results });
    }
    if (resource === "customers") {
      const result = await env.DB.prepare("SELECT id,email,first_name,last_name,phone,created_at,updated_at FROM customers WHERE (?='' OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?) ORDER BY created_at DESC LIMIT 100").bind(q, `%${q}%`, `%${q}%`, `%${q}%`).all();
      return NextResponse.json({ items: result.results });
    }
    if (resource === "services") {
      const result = await env.DB.prepare("SELECT id,customer_id,email,type,service_type_code,device_brand,device_model,imei_last4,device_serial_last4,carrier,problem_description,status,quote_in_cents,currency,assigned_technician_id,created_at,updated_at FROM service_requests WHERE (?='' OR email LIKE ? OR device_brand LIKE ? OR device_model LIKE ? OR status LIKE ?) ORDER BY created_at ASC LIMIT 100").bind(q, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`).all();
      return NextResponse.json({ items: result.results });
    }
    const result = await env.DB.prepare("SELECT o.*, (SELECT COUNT(*) FROM order_items i WHERE i.order_id=o.id) AS item_count FROM orders o WHERE (?='' OR o.order_number LIKE ? OR o.email LIKE ? OR o.status LIKE ?) ORDER BY o.created_at DESC LIMIT 100").bind(q, `%${q}%`, `%${q}%`, `%${q}%`).all();
    return NextResponse.json({ items: result.results });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const resource = clean(body.resource, 30);
    const id = clean(body.id, 100);
    if (!id) return NextResponse.json({ error: "Resource id is required" }, { status: 400 });
    const { admin, repo, env } = await requireAdmin(resource === "products" ? PERMISSIONS.productsWrite : resource === "services" ? PERMISSIONS.servicesWrite : PERMISSIONS.ordersWrite);
    if (resource === "products") {
      const allowed = new Set(["name","description","price_in_cents","stock","active","seo_title","seo_description","warranty_months","battery_health","storage_gb","color","specs_json"]);
      const fields = Object.keys(body).filter(k => allowed.has(k));
      if (!fields.length) return NextResponse.json({ error: "No editable fields" }, { status: 400 });
      const values = fields.map(k => body[k]);
      const set = fields.map(k => `${k}=?`).join(", ");
      await env.DB.prepare(`UPDATE products SET ${set}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...values, id).run();
    } else if (resource === "orders") {
      const status = clean(body.status, 30);
      const allowed = ['PENDING_PAYMENT','PAYMENT_PROCESSING','PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED','CANCELLED','REFUND_PENDING','REFUNDED'];
      if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid order status" }, { status: 400 });
      const current = await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(id).first<{status:string}>();
      if (!current) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      await env.DB.prepare("UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
      await env.DB.prepare("INSERT INTO order_events (id,order_id,event_type,payload_json) VALUES (?,?,?,?,)").bind(crypto.randomUUID(),id,"AdminOrderStatusChanged",json({from:current.status,to:status,adminId:admin.id})).run().catch(async()=>{ await env.DB.prepare("INSERT INTO order_events (id,order_id,event_type,payload_json) VALUES (?,?,?,?)").bind(crypto.randomUUID(),id,"AdminOrderStatusChanged",json({from:current.status,to:status,adminId:admin.id})).run(); });
    } else if (resource === "services") {
      const status = clean(body.status, 30);
      const allowed = ['PENDING','QUOTED','PAYMENT_PENDING','PAID','PROCESSING','WAITING_CUSTOMER','COMPLETED','REJECTED','REFUNDED'];
      if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid service status" }, { status: 400 });
      await env.DB.prepare("UPDATE service_requests SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,id).run();
      await env.DB.prepare("INSERT INTO service_audit_events (id,service_request_id,event_type,payload_json) VALUES (?,?,?,?,CURRENT_TIMESTAMP)").bind(crypto.randomUUID(),id,"AdminServiceStatusChanged",json({status,adminId:admin.id})).run();
    } else return NextResponse.json({ error: "Unsupported resource" }, { status: 400 });
    await repo.audit(admin.id, "ADMIN_RESOURCE_UPDATED", resource, id, body);
    return NextResponse.json({ updated: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : status === 401 ? "Authentication required" : "Unable to update resource" }, { status });
  }
}
