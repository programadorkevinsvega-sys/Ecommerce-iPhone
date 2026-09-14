export type AdminDashboardSnapshot = Readonly<{
  metrics: Readonly<{
    orders: number;
    customers: number;
    products: number;
    openServices: number;
    revenueInCents: number;
    pendingPayments: number;
    lowStock: number;
    sales: Readonly<{ paidOrders: number; unitsSold: number; averageOrderValueInCents: number; refundedOrders: number }>;
    operations: Readonly<{ ordersToday: number; cancelledOrders: number; outOfStock: number }>;
    customersDetail: Readonly<{ newLast30Days: number; repeatCustomers: number }>;
    payments: Readonly<{ paid: number; failed: number; pending: number; refunded: number }>;
  }>;
  recentOrders: readonly unknown[];
}>;

export interface AdminDashboardQuery {
  execute(): Promise<AdminDashboardSnapshot>;
}
