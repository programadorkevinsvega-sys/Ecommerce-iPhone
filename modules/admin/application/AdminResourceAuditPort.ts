export interface AdminResourceAuditPort {
  audit(
    adminUserId: string,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<void>;
}
