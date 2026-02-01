import { AwakensEvent, PerpsAdapter } from "../core/types";
import { formatDateUTC, truncateDecimals, fetchWithContext } from "./utils";

/**
 * GMX v2 (Synthetics) adapter — Arbitrum.
 *
 * Data source: Subsquid GraphQL endpoint
 *   https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql
 *
 * Queries the `tradeActions` entity which includes:
 *   - PositionIncrease events (opens / add to position)
 *   - PositionDecrease events (partial/full closes, with basePnlUsd)
 *
 * Key design decisions:
 *   - basePnlUsd is the platform-reported realized PnL for decrease events
 *   - sizeDeltaUsd values are in 30-decimal precision (raw BigInt from contracts)
 *   - Market addresses are resolved to asset symbols via the markets REST API
 *   - GMX does not have discrete funding payments; borrowing/funding fees are
 *     embedded in position decrease events. We do NOT fabricate separate funding rows.
 *   - Settlement token on Arbitrum is USDC
 *   - Liquidations are treated as close_position events
 */

const SUBSQUID_URL = "https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql";
const MARKETS_API = "https://arbitrum-api.gmxinfra.io/tokens/info";

// 10^30 — GMX stores USD values with 30 decimal places

// --- Types ---

type GMXTradeAction = {
  id: string;
  eventName: string;
  orderType: number;
  account: string;
  marketAddress: string;
  sizeDeltaUsd: string;
  collateralDeltaAmount: string;
  basePnlUsd: string;
  priceImpactUsd: string;
  isLong: boolean;
  executionPrice: string;
  orderKey: string;
  timestamp: number;
  transaction: {
    hash: string;
  };
};

type GMXMarketsResponse = {
  [address: string]: {
    symbol: string;
    address: string;
    decimals: number;
  };
};

// --- Market symbol resolution ---

// Cache market address → symbol mapping with TTL
let marketCache: Map<string, string> | null = null;
let marketCacheTimestamp = 0;
const MARKET_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getMarketSymbols(): Promise<Map<string, string>> {
  const now = Date.now();
  if (marketCache && (now - marketCacheTimestamp) < MARKET_CACHE_TTL_MS) {
    return marketCache;
  }

  try {
    const response = await fetch(MARKETS_API);
    if (response.ok) {
      const data: GMXMarketsResponse = await response.json();
      marketCache = new Map();
      for (const [addr, info] of Object.entries(data)) {
        marketCache.set(addr.toLowerCase(), info.symbol);
      }
      marketCacheTimestamp = now;
      return marketCache;
    }
  } catch {
    // Fall through — use stale cache if available, empty map otherwise
    if (marketCache) return marketCache;
  }

  marketCache = new Map();
  marketCacheTimestamp = now;
  return marketCache;
}

function resolveMarketSymbol(marketAddress: string, symbols: Map<string, string>): string {
  const symbol = symbols.get(marketAddress.toLowerCase());
  if (symbol) return symbol;
  // Fallback: return shortened address
  return `GMX-${marketAddress.slice(0, 8)}`;
}

// --- BigInt USD conversion ---

/**
 * Convert a GMX 30-decimal USD value string to a number truncated to 8 decimals.
 * GMX stores all USD values with 30 decimal places.
 *
 * Strategy: string manipulation to avoid floating point loss.
 * We strip 22 trailing digits (30 - 8 = 22), then parse the remaining
 * string as an integer and divide by 10^8.
 */
function parseGmxUsd(value: string): number {
  if (!value || value === "0") return 0;

  // Determine sign
  let str = value;
  let negative = false;
  if (str.startsWith("-")) {
    negative = true;
    str = str.slice(1);
  }

  // Pad to at least 31 chars so we can slice
  while (str.length < 31) {
    str = "0" + str;
  }

  // Remove last 22 digits (keeping 8 decimals of precision from 30)
  const significant = str.slice(0, str.length - 22);

  const intVal = parseInt(significant, 10);
  if (isNaN(intVal)) return 0;

  const result = intVal / 1e8;
  return truncateDecimals(negative ? -result : result);
}

// --- GraphQL query ---

const TRADE_ACTIONS_QUERY = `
  query GetTradeActions($account: String!, $skip: Int!, $first: Int!) {
    tradeActions(
      where: { account_eq: $account }
      orderBy: timestamp_DESC
      limit: $first
      offset: $skip
    ) {
      id
      eventName
      orderType
      account
      marketAddress
      sizeDeltaUsd
      collateralDeltaAmount
      basePnlUsd
      priceImpactUsd
      isLong
      executionPrice
      orderKey
      timestamp
      transaction {
        hash
      }
    }
  }
`;

async function fetchTradeActions(account: string): Promise<GMXTradeAction[]> {
  const allActions: GMXTradeAction[] = [];
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchWithContext(SUBSQUID_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRADE_ACTIONS_QUERY,
        variables: {
          account: account.toLowerCase(),
          skip: page * PAGE_SIZE,
          first: PAGE_SIZE,
        },
      }),
    }, "GMX");

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GMX Subsquid API error: ${response.status} — ${text}`);
    }

    const json = await response.json();

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `GMX Subsquid GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
      );
    }

    const actions: GMXTradeAction[] = json.data?.tradeActions || [];

    if (actions.length === 0) break;

    allActions.push(...actions);

    if (actions.length < PAGE_SIZE) break;
  }

  return allActions;
}

// --- Normalization ---

function normalizeTradeAction(
  action: GMXTradeAction,
  symbols: Map<string, string>
): AwakensEvent | null {
  const eventName = action.eventName;

  // Only handle PositionIncrease and PositionDecrease
  // Skip OrderCreated, OrderExecuted, OrderCancelled, OrderFrozen, etc.
  if (eventName !== "PositionIncrease" && eventName !== "PositionDecrease") {
    return null;
  }

  const isClose = eventName === "PositionDecrease";
  const asset = resolveMarketSymbol(action.marketAddress, symbols);
  const sizeDelta = Math.abs(parseGmxUsd(action.sizeDeltaUsd));
  const basePnl = parseGmxUsd(action.basePnlUsd);
  const priceImpact = parseGmxUsd(action.priceImpactUsd);

  // For close events, the realized PnL is basePnlUsd (includes price impact).
  // basePnlUsd is the platform-reported realized PnL from the smart contract.
  const realizedPnl = isClose ? truncateDecimals(basePnl + priceImpact) : 0;

  // GMX embeds fees in collateralDeltaAmount; we report priceImpact as a
  // component but don't fabricate a separate fee since GMX fees are complex
  // (position fee + borrowing fee + funding fee, all settled atomically).
  // For accuracy, we set fee to 0 and include the full basePnlUsd which
  // is already net of internal fee accounting.
  const fee = 0;

  const direction = action.isLong ? "Long" : "Short";
  const txHash = action.transaction?.hash
    ? `${action.transaction.hash}-${action.id}`
    : `gmx-${action.id}`;

  return {
    date: formatDateUTC(action.timestamp * 1000),
    asset,
    amount: sizeDelta,
    fee,
    pnl: realizedPnl,
    paymentToken: isClose ? "USDC" : "",
    notes: `${eventName} ${direction} @ ${action.executionPrice || "N/A"} (orderType=${action.orderType})`,
    txHash,
    tag: isClose ? "close_position" : "open_position",
  };
}

// --- Adapter ---

export const gmxAdapter: PerpsAdapter = {
  id: "gmx",
  name: "GMX",

  async getEvents(account: string): Promise<AwakensEvent[]> {
    if (!account || !account.startsWith("0x") || account.length !== 42) {
      throw new Error(
        "Invalid Ethereum address. Must be a 42-character hex address starting with 0x."
      );
    }

    const [actions, symbols] = await Promise.all([
      fetchTradeActions(account),
      getMarketSymbols(),
    ]);

    const events: AwakensEvent[] = [];
    for (const action of actions) {
      const event = normalizeTradeAction(action, symbols);
      if (event) {
        events.push(event);
      }
    }

    // Sort ascending by date
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return events;
  },
};
