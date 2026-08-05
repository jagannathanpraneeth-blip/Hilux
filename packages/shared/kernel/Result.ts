/**
 * Result<T, E> — Railway-oriented programming for error handling.
 *
 * WHY: In an async, distributed agent system, throwing exceptions creates
 * unpredictable control flow. Agents can fail in dozens of ways and we need
 * explicit, typed, composable error paths at every step.
 *
 * Result forces callers to handle both success and failure paths.
 * This eliminates "happy path only" code that crashes in production.
 *
 * Pattern inspired by Rust's Result<T, E> and Railway Oriented Programming.
 */
export type Result<T, E = Error> = Ok<T, E> | Fail<T, E>;

export class Ok<T, E> {
  readonly _tag = 'ok' as const;
  readonly value: T;
  readonly error?: undefined;

  constructor(value: T) {
    this.value = value;
  }

  isOk(): this is Ok<T, E> {
    return true;
  }

  isFailure(): this is Fail<T, E> {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapError(): never {
    throw new Error('Called unwrapError on an Ok result');
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return Result.ok(fn(this.value));
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  getOrElse(_fallback: T): T {
    return this.value;
  }
}

export class Fail<T, E> {
  readonly _tag = 'fail' as const;
  readonly error: E;
  readonly value?: undefined;

  constructor(error: E) {
    this.error = error;
  }

  isOk(): this is Ok<T, E> {
    return false;
  }

  isFailure(): this is Fail<T, E> {
    return true;
  }

  unwrap(): never {
    throw this.error instanceof Error ? this.error : new Error(String(this.error));
  }

  unwrapError(): E {
    return this.error;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return Result.fail(this.error);
  }

  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return Result.fail(this.error);
  }

  getOrElse(fallback: T): T {
    return fallback;
  }
}

// Static factory
export const Result = {
  ok<T, E = never>(value: T): Result<T, E> {
    return new Ok(value);
  },

  fail<T = never, E = Error>(error: E): Result<T, E> {
    return new Fail(error);
  },

  /**
   * Collect all results. If any fail, return the first failure.
   */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (result.isFailure()) return Result.fail(result.error);
      values.push(result.value);
    }
    return Result.ok(values);
  },
};
