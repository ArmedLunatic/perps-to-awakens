import { AwakensEvent, ValidationError } from "./types";

const VALID_TAGS = new Set([
  "open_position",
  "close_position",
  "funding_payment",
  "staking_reward",
  "slashing",
]);

const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

/**
 * Returns the maximum number of days in a given month/year.
 */
function daysInMonth(month: number, year: number): number {
  // month is 1-indexed
  return new Date(year, month, 0).getDate();
}

/**
 * Validates the date format: MM/DD/YYYY HH:MM:SS
 * Also validates that the date is actually parseable and calendar-correct.
 */
function validateDate(date: string): string | null {
  if (!DATE_REGEX.test(date)) {
    return `Invalid date format. Expected MM/DD/YYYY HH:MM:SS, got "${date}"`;
  }
  const [datePart, timePart] = date.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  if (month < 1 || month > 12) return `Invalid month: ${month}`;
  if (year < 2000 || year > 2100) return `Invalid year: ${year}`;
  const maxDay = daysInMonth(month, year);
  if (day < 1 || day > maxDay) return `Invalid day: ${day} (max ${maxDay} for ${month}/${year})`;
  if (hour < 0 || hour > 23) return `Invalid hour: ${hour}`;
  if (minute < 0 || minute > 59) return `Invalid minute: ${minute}`;
  if (second < 0 || second > 59) return `Invalid second: ${second}`;

  return null;
}

/**
 * Returns the number of decimal places in a number.
 */
function decimalPlaces(n: number): number {
  const s = n.toString();
  const dotIndex = s.indexOf(".");
  if (dotIndex === -1) return 0;
  // Handle scientific notation
  if (s.includes("e-")) {
    const [, exp] = s.split("e-");
    return parseInt(exp, 10) + (s.split(".")[1]?.split("e")[0]?.length ?? 0);
  }
  return s.length - dotIndex - 1;
}

/**
 * Validate a single AwakensEvent. Returns an array of errors (empty if valid).
 */
export function validateEvent(event: AwakensEvent, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Date
  const dateError = validateDate(event.date);
  if (dateError) {
    errors.push({ row: rowIndex, field: "date", message: dateError, value: event.date });
  }

  // Asset
  if (!event.asset || event.asset.trim() === "") {
    errors.push({ row: rowIndex, field: "asset", message: "Asset is required", value: event.asset });
  }

  // Amount must be a finite non-negative number
  if (!Number.isFinite(event.amount)) {
    errors.push({
      row: rowIndex,
      field: "amount",
      message: `Amount must be a finite number`,
      value: String(event.amount),
    });
  } else if (event.amount < 0) {
    errors.push({
      row: rowIndex,
      field: "amount",
      message: `Amount must be non-negative`,
      value: event.amount.toString(),
    });
  }

  // Amount precision
  if (Number.isFinite(event.amount) && decimalPlaces(event.amount) > 8) {
    errors.push({
      row: rowIndex,
      field: "amount",
      message: `Amount exceeds 8 decimal places`,
      value: event.amount.toString(),
    });
  }

  // Fee must be a finite non-negative number
  if (!Number.isFinite(event.fee)) {
    errors.push({
      row: rowIndex,
      field: "fee",
      message: `Fee must be a finite number`,
      value: String(event.fee),
    });
  } else if (event.fee < 0) {
    errors.push({
      row: rowIndex,
      field: "fee",
      message: `Fee must be non-negative`,
      value: event.fee.toString(),
    });
  }

  // Fee precision
  if (Number.isFinite(event.fee) && decimalPlaces(event.fee) > 8) {
    errors.push({
      row: rowIndex,
      field: "fee",
      message: `Fee exceeds 8 decimal places`,
      value: event.fee.toString(),
    });
  }

  // P&L must be a finite number
  if (!Number.isFinite(event.pnl)) {
    errors.push({
      row: rowIndex,
      field: "pnl",
      message: `P&L must be a finite number`,
      value: String(event.pnl),
    });
  }

  // P&L precision
  if (Number.isFinite(event.pnl) && decimalPlaces(event.pnl) > 8) {
    errors.push({
      row: rowIndex,
      field: "pnl",
      message: `P&L exceeds 8 decimal places`,
      value: event.pnl.toString(),
    });
  }

  // Tag
  if (!VALID_TAGS.has(event.tag)) {
    errors.push({
      row: rowIndex,
      field: "tag",
      message: `Invalid tag. Must be one of: ${[...VALID_TAGS].join(", ")}`,
      value: event.tag,
    });
  }

  // Transaction hash
  if (!event.txHash || event.txHash.trim() === "") {
    errors.push({
      row: rowIndex,
      field: "txHash",
      message: "Transaction hash is required",
      value: event.txHash,
    });
  }

  // Payment token required for close_position, funding_payment, staking_reward, slashing
  if (
    (event.tag === "close_position" ||
      event.tag === "funding_payment" ||
      event.tag === "staking_reward" ||
      event.tag === "slashing") &&
    !event.paymentToken
  ) {
    errors.push({
      row: rowIndex,
      field: "paymentToken",
      message: `Payment token is required for ${event.tag}`,
      value: event.paymentToken,
    });
  }

  // P&L must be 0 for open_position
  if (event.tag === "open_position" && event.pnl !== 0) {
    errors.push({
      row: rowIndex,
      field: "pnl",
      message: "P&L must be 0 for open_position events",
      value: event.pnl.toString(),
    });
  }

  // staking_reward: pnl must be > 0, fee must be 0
  if (event.tag === "staking_reward") {
    if (event.pnl <= 0) {
      errors.push({
        row: rowIndex,
        field: "pnl",
        message: "P&L must be > 0 for staking_reward events",
        value: event.pnl.toString(),
      });
    }
    if (event.fee !== 0) {
      errors.push({
        row: rowIndex,
        field: "fee",
        message: "Fee must be 0 for staking_reward events",
        value: event.fee.toString(),
      });
    }
  }

  // slashing: pnl must be < 0, fee must be 0
  if (event.tag === "slashing") {
    if (event.pnl >= 0) {
      errors.push({
        row: rowIndex,
        field: "pnl",
        message: "P&L must be < 0 for slashing events",
        value: event.pnl.toString(),
      });
    }
    if (event.fee !== 0) {
      errors.push({
        row: rowIndex,
        field: "fee",
        message: "Fee must be 0 for slashing events",
        value: event.fee.toString(),
      });
    }
  }

  return errors;
}

/**
 * Validate an array of events. Returns all errors + checks for duplicate txHashes.
 */
export function validateEvents(events: AwakensEvent[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const seenHashes = new Map<string, number>();

  for (let i = 0; i < events.length; i++) {
    errors.push(...validateEvent(events[i], i));

    const hash = events[i].txHash;
    if (seenHashes.has(hash)) {
      errors.push({
        row: i,
        field: "txHash",
        message: `Duplicate transaction hash (first seen at row ${seenHashes.get(hash)})`,
        value: hash,
      });
    } else {
      seenHashes.set(hash, i);
    }
  }

  return errors;
}
