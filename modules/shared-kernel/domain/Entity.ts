export abstract class Entity<TId extends string = string> {
  protected constructor(private readonly id: TId) {}

  getId(): TId {
    return this.id;
  }
}
