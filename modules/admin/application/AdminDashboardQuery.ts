export type AdminDashboardSnapshot = Readonly<{
  metrics: Readonly<{
    orders: number;
    customers: number;
    products: number;
    openServices: number;
    revenueInCents: number;
    pendingPayments: number;
    lowStock: number;
  }>;
  recentOrders: readonly unknown[];
}>;

export interface AdminDashboardQuery {
  execute(): Promise<AdminDashboardSnapshot>;
}
