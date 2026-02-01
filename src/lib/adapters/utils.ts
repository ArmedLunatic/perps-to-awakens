/**
 * Shared utilities for adapter implementations.
 * No business logic — only formatting and precision helpers.
 */

/**
 * Format a UTC timestamp (ms) to MM/DD/YYYY HH:MM:SS.
 */
export function formatDateUTC(timestampMs: number): string {
  const d = new Date(timestampMs);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

/**
 * Format an ISO 8601 date string to MM/DD/YYYY HH:MM:SS (UTC).
 */
export function formatISODateUTC(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date string: "${isoString}"`);
  }
  return formatDateUTC(d.getTime());
}

/**
 * Truncate a number to at most 8 decimal places.
 * Uses truncation (not rounding) to avoid introducing accounting errors.
 * Throws on NaN or Infinity to prevent corrupt data from propagating.
 */
export function truncateDecimals(n: number): number {
  if (!Number.isFinite(n)) {
    throw new Error(`truncateDecimals: input must be a finite number, got ${n}`);
  }
  return Math.trunc(n * 1e8) / 1e8;
}

/**
 * Parse a numeric string and truncate to 8 decimal places.
 * Throws on NaN or non-finite values.
 */
export function parseAndTruncate(value: string, fieldName: string): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${fieldName}: could not parse "${value}" as a finite number`);
  }
  return truncateDecimals(n);
}

/**
 * Wrap a fetch call with network error classification.
 * Distinguishes network connectivity failures from API-level errors.
 */
export async function fetchWithContext(
  url: string,
  init: RequestInit | undefined,
  platformName: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("fetch failed") || message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") || message.includes("ETIMEDOUT") ||
        message.includes("network") || message.includes("abort")) {
      throw new Error(
        `${platformName}: Network error — could not reach API. ` +
        `Check your internet connection or try again later. ` +
        `(${message})`
      );
    }
    throw new Error(`${platformName}: Request failed — ${message}`);
  }

  // Classify common HTTP error statuses before returning
  if (response.status === 429) {
    throw new Error(
      `${platformName}: Rate limited — the API rejected the request due to too many calls. ` +
      `Wait a few minutes and try again.`
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `${platformName}: Authentication failed (${response.status}). ` +
      `Check your API key and secret, then retry.`
    );
  }

  return response;
}

/**
 * Paginate through an API that returns arrays, using a cursor function.
 * Returns all results concatenated.
 */
export async function paginateAll<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | undefined }>,
  maxPages: number = 50
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined = undefined;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    all.push(...result.items);
    if (!result.nextCursor || result.items.length === 0) break;
    cursor = result.nextCursor;
  }

  return all;
}
