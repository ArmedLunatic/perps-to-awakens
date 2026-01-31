import { AwakensEvent } from "./types";
import { validateEvents } from "./validation";

/**
 * Exact Awakens CSV header. Order and spelling MUST NOT change.
 */
const CSV_HEADER = "Date,Asset,Amount,Fee,P&L,Payment Token,Notes,Transaction Hash,Tag";

/**
 * Format a number to at most 8 decimal places, stripping trailing zeros.
 */
function formatNumber(n: number): string {
  if (n === 0) return "0";
  // Use toFixed(8) then strip trailing zeros
  const fixed = n.toFixed(8);
  // Remove trailing zeros after decimal point
  const trimmed = fixed.replace(/\.?0+$/, "");
  return trimmed;
}

/**
 * Escape a CSV field. If the field contains commas, quotes, or newlines,
 * wrap it in double quotes and escape internal quotes.
 */
function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert an AwakensEvent to a CSV row string.
 */
function eventToCSVRow(event: AwakensEvent): string {
  const fields = [
    event.date,
    event.asset,
    formatNumber(event.amount),
    formatNumber(event.fee),
    formatNumber(event.pnl),
    event.paymentToken,
    event.notes || "",
    event.txHash,
    event.tag,
  ];
  return fields.map(escapeCSVField).join(",");
}

/**
 * Generate a strict Awakens-compatible CSV string.
 * Throws if any validation errors are found.
 */
export function generateCSV(events: AwakensEvent[]): string {
  const errors = validateEvents(events);
  if (errors.length > 0) {
    const summary = errors
      .slice(0, 10)
      .map((e) => `  Row ${e.row}: [${e.field}] ${e.message}`)
      .join("\n");
    const extra = errors.length > 10 ? `\n  ... and ${errors.length - 10} more errors` : "";
    throw new Error(`CSV export blocked — ${errors.length} validation error(s):\n${summary}${extra}`);
  }

  const rows = events.map(eventToCSVRow);
  return [CSV_HEADER, ...rows].join("\n");
}

/**
 * Validate the CSV header matches exactly.
 */
export function validateCSVHeader(header: string): boolean {
  return header.trim() === CSV_HEADER;
}

export { CSV_HEADER };
