import type { D1Database } from "@cloudflare/workers-types";
import type { AdminDashboardQuery, AdminDashboardSnapshot } from "../application/AdminDashboardQuery";

export class D1AdminDashboardQuery implements AdminDashboardQuery {
  constructor(private readonly db: D1Database) {}

  async execute(): Promise<AdminDashboardSnapshot> {
    const [orders, customers, products, services, revenue, pendingPayments, lowStock, paidOrders, unitsSold, refundedOrders, ordersToday, cancelledOrders, outOfStock, newCustomers, repeatCustomers, paidPayments, failedPayments, pendingPaymentRows, refundedPayments] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) AS count FROM orders").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM customers").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM service_requests WHERE status NOT IN ('COMPLETED','REFUNDED','REJECTED')").first<{ count: number }>(),
      this.db.prepare("SELECT COALESCE(SUM(total_in_cents),0) AS total FROM orders WHERE status IN ('PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED')").first<{ total: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1 AND stock <= 2").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED')").first<{ count: number }>(),
      this.db.prepare("SELECT COALESCE(SUM(quantity),0) AS count FROM order_items oi INNER JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('PAID','PROCESSING','READY_TO_SHIP','SHIPPED','DELIVERED')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status='REFUNDED'").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE date(created_at)=date('now')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('CANCELLED','REFUND_PENDING','REFUNDED')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM products WHERE active=1 AND stock=0").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM customers WHERE created_at >= datetime('now','-30 days')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM (SELECT customer_id FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) > 1)").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status='PAID'").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status='FAILED'").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status IN ('CREATED','PENDING','PROCESSING')").first<{ count: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM payments WHERE status='REFUNDED'").first<{ count: number }>(),
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
        sales: { paidOrders: paidOrders?.count ?? 0, unitsSold: unitsSold?.count ?? 0, averageOrderValueInCents: paidOrders?.count ? Math.round(Number(revenue?.total ?? 0) / paidOrders.count) : 0, refundedOrders: refundedOrders?.count ?? 0 },
        operations: { ordersToday: ordersToday?.count ?? 0, cancelledOrders: cancelledOrders?.count ?? 0, outOfStock: outOfStock?.count ?? 0 },
        customersDetail: { newLast30Days: newCustomers?.count ?? 0, repeatCustomers: repeatCustomers?.count ?? 0 },
        payments: { paid: paidPayments?.count ?? 0, failed: failedPayments?.count ?? 0, pending: pendingPaymentRows?.count ?? 0, refunded: refundedPayments?.count ?? 0 },
      },
      recentOrders: recent.results,
    };
  }
}
