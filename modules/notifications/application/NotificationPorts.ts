import type { NotificationEvent } from "../domain/NotificationEvent";

export type OutboxRecord = NotificationEvent & Readonly<{
  status: "PENDING" | "QUEUED" | "PROCESSED" | "FAILED";
  attempts: number;
  availableAt: string;
}>;

export interface NotificationOutboxRepository {
  enqueue(event: NotificationEvent): Promise<boolean>;
  pending(limit: number): Promise<OutboxRecord[]>;
  markQueued(id: string): Promise<void>;
  markProcessed(id: string): Promise<void>;
  markFailed(id: string, error: string, retryAt: string): Promise<void>;
  hasDelivery(outboxId: string, channel: "EMAIL", recipient: string, template: string): Promise<boolean>;
  recordDelivery(input: { outboxId: string; channel: "EMAIL"; recipient: string; template: string; provider: string; providerMessageId?: string; status: "SENT" | "FAILED"; attempts: number; errorMessage?: string }): Promise<void>;
}

export interface EmailProvider {
  send(input: { to: string; subject: string; html: string; text: string; tags?: Record<string, string> }): Promise<{ id?: string }>;
}
