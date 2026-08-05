/**
 * ValueObject — Base class for all DDD value objects.
 *
 * Value Objects have no identity. Two value objects are equal if all
 * their properties are equal. They are immutable — operations that
 * would mutate a value object return a new instance instead.
 *
 * Examples: Money, Email, Goal, MissionBudget, AcceptanceCriteria
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    // Deep freeze to enforce immutability
    this.props = Object.freeze({ ...props });
  }

  public equals(other: ValueObject<TProps>): boolean {
    if (!(other instanceof ValueObject)) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
