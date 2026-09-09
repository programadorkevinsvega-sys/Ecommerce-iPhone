export abstract class ValueObject<T extends object> {
  protected constructor(readonly props: Readonly<T>) {}

  equals(other?: ValueObject<T>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
