import { AwakensEvent, PerpsAdapter, AdapterOptions } from "../core/types";
import { formatDateUTC, parseAndTruncate } from "./utils";

/**
 * Aevo adapter — Full implementation.
 *
 * Data source: Aevo REST API (https://api.aevo.xyz)
 *   - GET /trade-history — account trade fills (requires API key + secret)
 *     Supports trade_type filtering: "trade", "liquidation", "settlement", "funding"
 *   - Funding payments are fetched as trade_type="funding" from the same endpoint
 *
 * Authentication:
 *   - AEVO-KEY + AEVO-SECRET headers (simple key/secret mode)
 *   - API keys can be created at https://app.aevo.xyz/settings/api-keys
 *   - Read-only keys are sufficient for trade history
 *
 * Key design decisions:
 *   - `is_closing` boolean directly indicates close vs open
 *   - `realized_pnl` is the platform-reported realized P&L (only on closing trades)
 *   - Timestamps are in nanoseconds — divided by 10^6 for milliseconds
 *   - Only perpetual instruments (ending in "-PERP") are processed
 *   - Settlement token is USDC
 *   - Funding events from trade_type="funding" are exported as funding_payment
 *   - Pagination: offset/limit with max 50 per page
 */

const AEVO_API = "https://api.aevo.xyz";

// --- Types ---

type AevoTrade = {
  trade_id: string;
  timestamp: string; // nanoseconds
  instrument_name: string;
  side: string; // "buy" | "sell"
  price: string;
  amount: string;
  filled: string;
  fees: string;
  liquidity: string;
  is_closing: boolean;
  realized_pnl?: string;
  trade_type?: string;
};

// --- Fetching ---

async function fetchTradeHistory(
  account: string,
  apiKey: string,
  apiSecret: string
): Promise<AevoTrade[]> {
  const all: AevoTrade[] = [];
  const PAGE_SIZE = 50;
  const MAX_PAGES = 100;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      account,
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });

    const response = await fetch(`${AEVO_API}/trade-history?${params}`, {
      headers: {
        "AEVO-KEY": apiKey,
        "AEVO-SECRET": apiSecret,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Aevo API error: ${response.status} — ${text}`);
    }

    const data = await response.json();

    // Response may be { trade_history: [...] } or directly an array
    const trades: AevoTrade[] = Array.isArray(data)
      ? data
      : data.trade_history || [];

    if (trades.length === 0) break;

    all.push(...trades);

    if (trades.length < PAGE_SIZE) break;
  }

  return all;
}

// --- Normalization ---

function normalizeTrade(trade: AevoTrade): AwakensEvent | null {
  // Only process perpetual instruments
  if (!trade.instrument_name?.endsWith("-PERP")) return null;

  const asset = trade.instrument_name.replace("-PERP", "");

  // Parse nanosecond timestamp
  const tsStr = trade.timestamp;
  if (!tsStr) return null;

  // Nanoseconds can exceed Number.MAX_SAFE_INTEGER, so parse carefully
  // We only need millisecond precision: drop last 6 digits
  let timestampMs: number;
  if (tsStr.length > 6) {
    timestampMs = parseInt(tsStr.slice(0, tsStr.length - 6), 10);
  } else {
    timestampMs = 0;
  }
  if (isNaN(timestampMs) || timestampMs <= 0) return null;

  const isFunding = trade.trade_type === "funding";
  const isClose = trade.is_closing === true;

  const filled = parseAndTruncate(trade.filled || trade.amount || "0", "filled");
  const fee = parseAndTruncate(trade.fees || "0", "fees");
  const realizedPnl =
    trade.realized_pnl && trade.realized_pnl !== "0"
      ? parseAndTruncate(trade.realized_pnl, "realized_pnl")
      : 0;

  const tradeId = trade.trade_id || tsStr;

  if (isFunding) {
    // Funding events: amount = |pnl|, pnl = realized funding
    return {
      date: formatDateUTC(timestampMs),
      asset,
      amount: Math.abs(realizedPnl),
      fee: 0,
      pnl: realizedPnl,
      paymentToken: "USDC",
      notes: `Funding payment ${trade.side} ${trade.instrument_name}`,
      txHash: `aevo-funding-${tradeId}`,
      tag: "funding_payment",
    };
  }

  if (isClose) {
    return {
      date: formatDateUTC(timestampMs),
      asset,
      amount: filled,
      fee,
      pnl: realizedPnl,
      paymentToken: "USDC",
      notes: `${trade.side} ${trade.instrument_name} @ ${trade.price} (${trade.liquidity || "taker"})`,
      txHash: `aevo-${tradeId}`,
      tag: "close_position",
    };
  }

  // Open position
  return {
    date: formatDateUTC(timestampMs),
    asset,
    amount: filled,
    fee,
    pnl: 0,
    paymentToken: "",
    notes: `${trade.side} ${trade.instrument_name} @ ${trade.price} (${trade.liquidity || "taker"})`,
    txHash: `aevo-${tradeId}`,
    tag: "open_position",
  };
}

// --- Adapter ---

export const aevoAdapter: PerpsAdapter = {
  id: "aevo",
  name: "Aevo",
  requiresAuth: true,

  async getEvents(
    account: string,
    options?: AdapterOptions
  ): Promise<AwakensEvent[]> {
    if (!account || !account.startsWith("0x") || account.length !== 42) {
      throw new Error(
        "Invalid Ethereum address. Must be a 42-character hex address starting with 0x."
      );
    }

    if (!options?.apiKey || !options?.apiSecret) {
      throw new Error(
        "Aevo requires an API key and secret for trade history access. " +
          "Create a read-only API key at https://app.aevo.xyz/settings/api-keys"
      );
    }

    const trades = await fetchTradeHistory(
      account,
      options.apiKey,
      options.apiSecret
    );

    const events: AwakensEvent[] = [];
    for (const trade of trades) {
      const event = normalizeTrade(trade);
      if (event) events.push(event);
    }

    // Sort ascending by date
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return events;
  },
};
