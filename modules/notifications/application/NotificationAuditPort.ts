export interface NotificationAuditPort {
  record(input: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string | undefined;
    payload: Record<string, unknown>;
  }): Promise<void>;
}
