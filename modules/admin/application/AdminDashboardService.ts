import type { AdminDashboardQuery, AdminDashboardSnapshot } from "./AdminDashboardQuery";

export class AdminDashboardService {
  constructor(private readonly query: AdminDashboardQuery) {}

  execute(): Promise<AdminDashboardSnapshot> {
    return this.query.execute();
  }
}
