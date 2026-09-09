import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/adminAuth";
import { PERMISSIONS } from "../../../../../../modules/admin/infrastructure/AdminSecurity";

export async function GET() {
  try {
    const { repo, env } = await requireAdmin(PERMISSIONS.dashboardRead);
    const [orders, customers, products, services, revenue, pendingPayments, lowStock] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM orders").first<{count:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM customers").first<{count:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1").first<{count:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM service_requests WHERE status NOT IN ('COMPLETED','REFUNDED','REJECTED')").first<{count:number}>(),
      env.DB.prepare("SELECT COALESCE(SUM(total_in_cents),0) AS total FROM orders WHERE status IN ('PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED')").first<{total:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING')").first<{count:number}>(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1 AND stock <= 2").first<{count:number}>(),
    ]);
    const recent = await env.DB.prepare("SELECT id,order_number,email,status,total_in_cents,currency,created_at FROM orders ORDER BY created_at DESC LIMIT 10").all();
    await repo.audit((await requireAdmin(PERMISSIONS.dashboardRead)).admin.id, "ADMIN_DASHBOARD_VIEW", "dashboard", null, {});
    return NextResponse.json({ metrics: { orders: orders?.count ?? 0, customers: customers?.count ?? 0, products: products?.count ?? 0, openServices: services?.count ?? 0, revenueInCents: revenue?.total ?? 0, pendingPayments: pendingPayments?.count ?? 0, lowStock: lowStock?.count ?? 0 }, recentOrders: recent.results });
  } catch (error) {
    const status = error instanceof Error && error.message === "FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: status === 403 ? "Forbidden" : "Authentication required" }, { status });
  }
}
