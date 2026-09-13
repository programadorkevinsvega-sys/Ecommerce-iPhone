import type { AdminDashboardQuery, AdminDashboardSnapshot } from "./AdminDashboardQuery";
import type { AuditPort } from "./AuditPort";

export class AdminDashboardService {
  constructor(
    private readonly query: AdminDashboardQuery,
    private readonly audit: AuditPort,
  ) {}

  async execute(adminUserId: string): Promise<AdminDashboardSnapshot> {
    const snapshot = await this.query.execute();
    await this.audit.audit(adminUserId, "ADMIN_DASHBOARD_VIEW", "dashboard", null, {});
    return snapshot;
  }
}
