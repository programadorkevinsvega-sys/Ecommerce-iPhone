export interface NotificationRawQueuePort {
  publishRaw(message: string): Promise<void>;
}
