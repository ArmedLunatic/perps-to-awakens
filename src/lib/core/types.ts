/**
 * Awakens-compatible event type.
 * Every adapter MUST return only validated instances of this type.
 */
export type AwakensTag =
  | "open_position"
  | "close_position"
  | "funding_payment"
  | "staking_reward"
  | "slashing";

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

export type AdapterMode = "strict" | "assisted";

/**
 * Options passed to adapters that require authentication or extra config.
 */
export type AdapterOptions = {
  apiKey?: string;
  apiSecret?: string;
};

/**
 * Adapter interface. Every perpetuals platform adapter MUST implement this.
 */
export interface PerpsAdapter {
  /** Unique adapter identifier (e.g. "hyperliquid") */
  id: string;
  /** Human-readable platform name */
  name: string;
  /** Whether the adapter requires API key authentication */
  requiresAuth?: boolean;
  /** Confidence mode — defaults to "strict" */
  mode?: AdapterMode;
  /** Adapter family (e.g. "substrate-staking", "cosmos-staking", "cosmwasm-perps") */
  family?: string;
  /** Tags this adapter can emit */
  supports?: string[];
  /** Tags this adapter will never emit */
  blocks?: string[];
  /** Fetch and normalize all events for the given account */
  getEvents(account: string, options?: AdapterOptions): Promise<AwakensEvent[]>;
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

/**
 * Error classification for user-facing error recovery.
 *
 * - user-fixable: the user can resolve this by changing input (address format, API key, etc.)
 * - mode-fixable: switching mode (strict → assisted) or adjusting scope could resolve it
 * - system-blocked: a protocol or design limitation that cannot be resolved by the user
 */
export type ErrorClassification = "user-fixable" | "mode-fixable" | "system-blocked";

/**
 * Structured error returned from API with recovery guidance.
 */
export type ClassifiedError = {
  type: "network" | "rate-limit" | "auth" | "validation" | "blocked-by-design" | "internal";
  reason: string;
  userAction?: string;
  blockedByDesign: boolean;
};
