/**
 * Generates a unique identifier using a combination of timestamp and random characters.
 * More robust than Date.now().toString() as it prevents collisions in rapid succession.
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomPart}`;
}

/**
 * Safely parses JSON with error handling.
 * Returns the fallback value if parsing fails.
 */
export function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback;
  }
  
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error('Failed to parse JSON from storage');
    return fallback;
  }
}

/**
 * Safely stringifies data with error handling.
 * Returns null if stringification fails.
 */
export function safeJsonStringify<T>(data: T): string | null {
  try {
    return JSON.stringify(data);
  } catch {
    console.error('Failed to stringify data for storage');
    return null;
  }
}

/**
 * Formats a date string safely with fallback for invalid dates.
 */
export function formatDateSafe(dateString: string, fallback = 'N/A'): string {
  if (!dateString) {
    return fallback;
  }
  
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  
  return date.toLocaleDateString();
}
