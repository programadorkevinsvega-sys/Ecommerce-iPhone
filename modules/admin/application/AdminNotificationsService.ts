import type { AdminNotificationsQuery, AdminNotificationsSnapshot } from "./AdminNotificationsQuery";

export class AdminNotificationsService {
  constructor(private readonly query: AdminNotificationsQuery) {}

  execute(limit: number): Promise<AdminNotificationsSnapshot> {
    const normalizedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 50;
    return this.query.execute(normalizedLimit);
  }
}
