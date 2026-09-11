import type { D1Database } from "@cloudflare/workers-types";
import type { AdminDashboardQuery, AdminDashboardSnapshot } from "../application/AdminDashboardQuery";

export class D1AdminDashboardQuery implements AdminDashboardQuery {
  constructor(private readonly db: D1Database) {}

  async execute(): Promise<AdminDashboardSnapshot> {
    const [orders, customers, products, services, revenue, pendingPayments, lowStock] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) AS count FROM orders").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM customers").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM service_requests WHERE status NOT IN ('COMPLETED','REFUNDED','REJECTED')").first<{ count: number }>(),
      this.db.prepare("SELECT COALESCE(SUM(total_in_cents),0) AS total FROM orders WHERE status IN ('PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED')").first<{ total: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1 AND stock <= 2").first<{ count: number }>(),
    ]);
    const recent = await this.db.prepare("SELECT id,order_number,email,status,total_in_cents,currency,created_at FROM orders ORDER BY created_at DESC LIMIT 10").all();
    return {
      metrics: {
        orders: orders?.count ?? 0,
        customers: customers?.count ?? 0,
        products: products?.count ?? 0,
        openServices: services?.count ?? 0,
        revenueInCents: revenue?.total ?? 0,
        pendingPayments: pendingPayments?.count ?? 0,
        lowStock: lowStock?.count ?? 0,
      },
      recentOrders: recent.results,
    };
  }
}
