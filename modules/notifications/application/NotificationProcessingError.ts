export class NotificationProviderError extends Error {
  readonly retryable: boolean;
  readonly status?: number | undefined;

  constructor(message: string, options: { retryable: boolean; status?: number | undefined }) {
    super(message);
    this.name = "NotificationProviderError";
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export class NotificationTerminalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationTerminalError";
  }
}
