export interface DomainEvent<TPayload = unknown> {
  readonly eventName: string;
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly payload: TPayload;
}

export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}
