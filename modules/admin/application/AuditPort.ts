export interface AuditPort {
  audit(
    adminUserId: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<void>;
}
