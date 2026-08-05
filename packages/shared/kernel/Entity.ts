/**
 * Entity — Base class for all DDD entities.
 *
 * Entities have identity. Two entities are equal if and only if
 * their identifiers are equal, regardless of their other attributes.
 * This is the fundamental distinction from Value Objects.
 */
export abstract class Entity<TId> {
  protected readonly _id: TId;

  protected constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  public equals(other: Entity<TId>): boolean {
    if (!(other instanceof Entity)) return false;
    if (this.constructor !== other.constructor) return false;
    if (this === other) return true;
    return JSON.stringify(this._id) === JSON.stringify(other._id);
  }
}
