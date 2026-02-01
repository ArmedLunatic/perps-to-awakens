import { AwakensEvent, PerpsAdapter } from "../core/types";
import { formatDateUTC, parseAndTruncate, fetchWithContext } from "./utils";

/**
 * Kwenta adapter — Close-only mode.
 *
 * Data source: Kwenta subgraph on Optimism (The Graph)
 *   Queries FuturesTrade entities for trades with realized PnL.
 *
 * Close-only mode means:
 *   - Only exports close_position events (full and partial closes)
 *   - Uses the platform-reported `pnl` field from FuturesTrade (realized P&L)
 *   - Does NOT export open_position events (no reliable tagging without full state)
 *   - Does NOT export funding_payment events (funding is not discrete in Synthetix —
 *     it's accrued via fundingIndex deltas and settled on position modification)
 *
 * Detection of close events:
 *   - positionClosed=true → full close (position fully settled)
 *   - pnl != 0 → partial or full close with realized P&L
 *   - Trades with pnl=0 are skipped (opens or break-even closes — ambiguous)
 *
 * Settlement token: sUSD (Synthetix stablecoin)
 *
 * Known limitations:
 *   - The Graph hosted service is deprecated; the subgraph URL may need updating
 *     to a decentralized network gateway endpoint
 *   - Smart margin accounts: `account` in the subgraph may be the smart margin
 *     contract address, not the user's EOA. Users may need to enter their
 *     Kwenta smart margin address.
 *   - Break-even closes (pnl=0) are excluded to avoid misclassifying opens
 *   - Only Optimism network; Base deployment is not covered
 *   - Max 5000 trades fetched (5 pages × 1000)
 */

/**
 * Kwenta subgraph endpoint.
 * The Graph hosted service (api.thegraph.com) was sunset in 2024.
 * Using The Graph's decentralized gateway. If this URL becomes unavailable,
 * the adapter will throw a clear network error rather than silently fail.
 */
const SUBGRAPH_URL =
  "https://gateway.thegraph.com/api/subgraphs/id/2tTiLxz6JCcTBBHcNpFH4LRYzLZQFbDBiGmvaRnZWP5o";

// --- Types ---

type KwentaTrade = {
  id: string;
  timestamp: string;
  account: string;
  abstractAccount: string;
  asset: string;
  marketKey: string;
  size: string;
  price: string;
  positionSize: string;
  positionClosed: boolean;
  pnl: string;
  feesPaid: string;
  keeperFeesPaid: string;
  orderType: string;
  txHash: string;
};

// --- GraphQL ---

const TRADES_QUERY = `
  query GetTrades($account: String!, $skip: Int!) {
    futuresTrades(
      where: { account: $account }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
      skip: $skip
    ) {
      id
      timestamp
      account
      abstractAccount
      asset
      marketKey
      size
      price
      positionSize
      positionClosed
      pnl
      feesPaid
      keeperFeesPaid
      orderType
      txHash
    }
  }
`;

// Also try querying by abstractAccount (smart margin account owner)
const TRADES_QUERY_BY_ABSTRACT = `
  query GetTrades($account: String!, $skip: Int!) {
    futuresTrades(
      where: { abstractAccount: $account }
      orderBy: timestamp
      orderDirection: desc
      first: 1000
      skip: $skip
    ) {
      id
      timestamp
      account
      abstractAccount
      asset
      marketKey
      size
      price
      positionSize
      positionClosed
      pnl
      feesPaid
      keeperFeesPaid
      orderType
      txHash
    }
  }
`;

async function fetchTrades(account: string): Promise<KwentaTrade[]> {
  const allTrades: KwentaTrade[] = [];
  const MAX_PAGES = 5;

  // Try direct account match first
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchWithContext(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TRADES_QUERY,
        variables: {
          account: account.toLowerCase(),
          skip: page * 1000,
        },
      }),
    }, "Kwenta");

    if (!response.ok) {
      throw new Error(
        `Kwenta subgraph error: ${response.status} — ${await response.text()}`
      );
    }

    const json = await response.json();

    if (json.errors?.length > 0) {
      throw new Error(
        `Kwenta subgraph GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
      );
    }

    const trades: KwentaTrade[] = json.data?.futuresTrades || [];
    if (trades.length === 0) break;

    allTrades.push(...trades);
    if (trades.length < 1000) break;
  }

  // If no results, try abstractAccount (owner of smart margin account)
  if (allTrades.length === 0) {
    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await fetchWithContext(SUBGRAPH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: TRADES_QUERY_BY_ABSTRACT,
          variables: {
            account: account.toLowerCase(),
            skip: page * 1000,
          },
        }),
      }, "Kwenta");

      if (!response.ok) break;

      const json = await response.json();
      if (json.errors?.length > 0) break;

      const trades: KwentaTrade[] = json.data?.futuresTrades || [];
      if (trades.length === 0) break;

      allTrades.push(...trades);
      if (trades.length < 1000) break;
    }
  }

  return allTrades;
}

// --- Asset symbol resolution ---

/**
 * Resolve Synthetix market key (bytes32 hex) or asset identifier to a symbol.
 * Market keys like "sETHPERP" or hex-encoded bytes32 are cleaned up.
 */
function resolveAsset(asset: string, marketKey: string): string {
  // If asset is a readable symbol, use it
  if (asset && !asset.startsWith("0x")) {
    // Strip leading 's' if it's a synth identifier (e.g., "sETH" → "ETH")
    if (asset.startsWith("s") && asset.length > 1 && asset[1] === asset[1].toUpperCase()) {
      return asset.slice(1);
    }
    return asset;
  }

  // Try marketKey
  if (marketKey && !marketKey.startsWith("0x")) {
    const cleaned = marketKey.replace(/PERP$/i, "").replace(/^s/i, "");
    return cleaned || marketKey;
  }

  // Fallback: shortened hex
  if (asset) return `KWENTA-${asset.slice(0, 10)}`;
  if (marketKey) return `KWENTA-${marketKey.slice(0, 10)}`;
  return "UNKNOWN";
}

// --- Normalization ---

function normalizeCloseTrade(trade: KwentaTrade): AwakensEvent | null {
  const pnl = parseFloat(trade.pnl || "0");

  // Close-only mode: skip trades with zero PnL (likely opens or break-even)
  if (pnl === 0) return null;

  const asset = resolveAsset(trade.asset, trade.marketKey);
  const timestamp = parseInt(trade.timestamp, 10);
  if (isNaN(timestamp) || timestamp <= 0) return null;

  // Size delta (negative = reducing position, but we use absolute value)
  const size = parseAndTruncate(trade.size || "0", "size");
  const realizedPnl = parseAndTruncate(trade.pnl, "pnl");
  const feesPaid = parseAndTruncate(trade.feesPaid || "0", "feesPaid");
  const keeperFees = parseAndTruncate(
    trade.keeperFeesPaid || "0",
    "keeperFeesPaid"
  );
  const totalFee = feesPaid + keeperFees;

  const orderLabel =
    trade.orderType === "Liquidation" ? "Liquidation" : trade.orderType || "Close";

  return {
    date: formatDateUTC(timestamp * 1000),
    asset,
    amount: Math.abs(size),
    fee: totalFee,
    pnl: realizedPnl,
    paymentToken: "sUSD",
    notes: `${orderLabel} @ ${trade.price || "N/A"} (${trade.positionClosed ? "full close" : "partial close"})`,
    txHash: trade.txHash
      ? `${trade.txHash}-${trade.id}`
      : `kwenta-${trade.id}`,
    tag: "close_position",
  };
}

// --- Adapter ---

export const kwentaAdapter: PerpsAdapter = {
  id: "kwenta",
  name: "Kwenta",

  async getEvents(account: string): Promise<AwakensEvent[]> {
    if (!account || !account.startsWith("0x") || account.length !== 42) {
      throw new Error(
        "Invalid Ethereum address. Must be a 42-character hex address starting with 0x. " +
          "Note: You may need to use your Kwenta smart margin account address, " +
          "not your EOA wallet address."
      );
    }

    const trades = await fetchTrades(account);

    const events: AwakensEvent[] = [];
    for (const trade of trades) {
      const event = normalizeCloseTrade(trade);
      if (event) events.push(event);
    }

    // Sort ascending by date
    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return events;
  },
};
