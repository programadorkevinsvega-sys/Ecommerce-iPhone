import type { DomainEvent } from "./DomainEvent";
import { Entity } from "./Entity";

export abstract class AggregateRoot<TId extends string = string> extends Entity<TId> {
  private readonly domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  pullDomainEvents(): DomainEvent[] {
    return this.domainEvents.splice(0, this.domainEvents.length);
  }
}
