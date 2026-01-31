/**
 * Awakens-compatible event type.
 * Every adapter MUST return only validated instances of this type.
 */
export type AwakensTag = "open_position" | "close_position" | "funding_payment";

export type AwakensEvent = {
  date: string; // MM/DD/YYYY HH:MM:SS (UTC)
  asset: string;
  amount: number;
  fee: number;
  pnl: number;
  paymentToken: string;
  notes: string;
  txHash: string;
  tag: AwakensTag;
};

/**
 * Adapter interface. Every perpetuals platform adapter MUST implement this.
 */
export interface PerpsAdapter {
  /** Unique adapter identifier (e.g. "hyperliquid") */
  id: string;
  /** Human-readable platform name */
  name: string;
  /** Fetch and normalize all perpetuals events for the given account */
  getEvents(account: string): Promise<AwakensEvent[]>;
}

/**
 * Validation error returned when an event fails pre-export checks.
 */
export type ValidationError = {
  row: number;
  field: string;
  message: string;
  value: string;
};
