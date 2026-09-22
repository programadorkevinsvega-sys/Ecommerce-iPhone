export type NotificationDeadLetter = Readonly<{
  id: string;
  queueName: string;
  messageId?: string | undefined;
  messageBody: string;
  status: "OPEN" | "REPLAYED";
  attempts: number;
  firstSeenAt: string;
  lastReplayedAt?: string | undefined;
  replayedBy?: string | undefined;
}>;

export interface NotificationDeadLetterRepository {
  record(input: { id: string; queueName: string; messageId?: string | undefined; messageBody: string }): Promise<void>;
  list(limit: number): Promise<NotificationDeadLetter[]>;
  find(id: string): Promise<NotificationDeadLetter | null>;
  markReplayed(id: string, adminId: string): Promise<boolean>;
}
