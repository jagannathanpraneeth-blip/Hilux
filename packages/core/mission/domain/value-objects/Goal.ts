/**
 * Goal — Value Object representing a user's stated intent.
 *
 * A Goal is the natural-language statement of desired outcome.
 * It is validated on creation to ensure it is non-empty and within
 * our supported character limits.
 *
 * Goals are IMMUTABLE once created. If a goal changes, a new mission
 * must be created. This ensures mission history integrity.
 */
import { ValueObject } from '../../../../shared/kernel/ValueObject.js';
import { Result } from '../../../../shared/kernel/Result.js';
import { DomainError } from '../../../../shared/errors/DomainError.js';

interface GoalProps {
  text: string;
  embeddingVector?: number[];  // Set after embedding by infrastructure
}

export class Goal extends ValueObject<GoalProps> {
  static readonly MIN_LENGTH = 10;
  static readonly MAX_LENGTH = 4000;

  private constructor(props: GoalProps) {
    super(props);
  }

  static create(text: string, embeddingVector?: number[]): Result<Goal, DomainError> {
    const trimmed = text.trim();

    if (trimmed.length < Goal.MIN_LENGTH) {
      return Result.fail(
        new DomainError(`Goal must be at least ${Goal.MIN_LENGTH} characters. Got: "${trimmed}"`)
      );
    }

    if (trimmed.length > Goal.MAX_LENGTH) {
      return Result.fail(
        new DomainError(`Goal exceeds maximum length of ${Goal.MAX_LENGTH} characters.`)
      );
    }

    return Result.ok(new Goal({ text: trimmed, embeddingVector }));
  }

  get text(): string {
    return this.props.text;
  }

  get embeddingVector(): number[] | undefined {
    return this.props.embeddingVector;
  }

  withEmbedding(vector: number[]): Goal {
    return new Goal({ ...this.props, embeddingVector: vector });
  }

  toString(): string {
    return this.props.text;
  }
}
