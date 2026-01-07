/**
 * Input sanitization utilities for SQL injection prevention
 */

/**
 * Escape special characters for PostgreSQL ILIKE patterns
 * Prevents SQL injection via pattern manipulation
 */
export function escapeILike(input: string): string {
  return input.replace(/([%_\\])/g, '\\$1');
}

/**
 * Validate that a string looks like a valid Clerk user ID
 * Clerk IDs are alphanumeric with underscores
 */
export function isValidClerkId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length < 100;
}

/**
 * Throws if ID is not valid, returns the ID if valid
 */
export function validateClerkId(id: string, fieldName: string = 'id'): string {
  if (!isValidClerkId(id)) {
    throw new Error(`Invalid ${fieldName}: contains invalid characters`);
  }
  return id;
}
