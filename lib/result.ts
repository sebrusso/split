/**
 * Result Type for Better Error Handling
 *
 * A discriminated union type that represents either a successful operation
 * with data or a failed operation with an error message.
 */

/**
 * Represents a successful result with data
 */
export interface Success<T> {
  success: true;
  data: T;
}

/**
 * Represents a failed result with an error
 */
export interface Failure {
  success: false;
  error: string;
  code?: string; // Optional error code (e.g., PostgreSQL error codes)
}

/**
 * A Result type that is either Success<T> or Failure
 */
export type Result<T> = Success<T> | Failure;

/**
 * Create a successful result
 */
export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

/**
 * Create a failed result
 */
export function fail(error: string, code?: string): Failure {
  return { success: false, error, code };
}

/**
 * Check if a result is successful
 */
export function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.success === true;
}

/**
 * Check if a result is a failure
 */
export function isFailure<T>(result: Result<T>): result is Failure {
  return result.success === false;
}

/**
 * Map a successful result to a new value
 */
export function mapResult<T, U>(
  result: Result<T>,
  fn: (data: T) => U
): Result<U> {
  if (isSuccess(result)) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Unwrap a result, throwing an error if it's a failure
 */
export function unwrap<T>(result: Result<T>): T {
  if (isSuccess(result)) {
    return result.data;
  }
  throw new Error(result.error);
}

/**
 * Unwrap a result with a default value for failures
 */
export function unwrapOr<T>(result: Result<T>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Common PostgreSQL error codes
 */
export const PostgresErrorCodes = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_CONSTRAINT_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  NO_DATA_FOUND: "PGRST116",
} as const;

/**
 * Check if an error is a specific PostgreSQL error
 */
export function isPostgresError(
  result: Result<unknown>,
  code: string
): boolean {
  return isFailure(result) && result.code === code;
}
