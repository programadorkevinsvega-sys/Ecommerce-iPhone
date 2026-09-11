export type AuditFilter = Readonly<{ adminUserId?: string; action?: string; resourceType?: string; resourceId?: string; from?: string; to?: string; limit: number; offset: number }>;
export type AuditRepository = { list(filter: AuditFilter): Promise<Readonly<{ items: unknown[]; total: number }>> };

export class AdminAuditViewer {
  constructor(private readonly repository: AuditRepository) {}
  async execute(filter: Partial<AuditFilter>) {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);
    return this.repository.list({ ...filter, limit, offset });
  }
}
