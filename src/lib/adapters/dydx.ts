import { AwakensEvent, PerpsAdapter } from "../core/types";
import { formatISODateUTC, truncateDecimals, parseAndTruncate } from "./utils";

/**
 * dYdX v4 adapter.
 *
 * Data sources:
 *   - GET /v4/fills — trade fills with side, size, price, fee, market, createdAt
 *   - GET /v4/fundingPayments — per-user funding payments with market, payment, rate
 *
 * Base URL: https://indexer.dydx.trade
 *
 * Key assumptions verified against official docs (docs.dydx.xyz/indexer-client/http):
 *   - Fills include a `realizedPnl` field for close events
 *   - If the API does not return `realizedPnl` per fill, this adapter throws
 *   - Side is "BUY" or "SELL" — combined with realizedPnl to determine open vs close
 *   - Settlement token is USDC
 *   - dYdX v4 addresses are bech32 format: dydx1...
 */

const INDEXER_BASE = "https://indexer.dydx.trade/v4";
const PAGE_LIMIT = 100;
const MAX_PAGES = 100; // 100 * 100 = 10k fills max

// --- Raw API types ---

type DydxFill = {
  id: string;
  side: "BUY" | "SELL";
  liquidity: string;
  type: string;
  market: string;
  marketType: string;
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  createdAtHeight: string;
  orderId: string;
  transactionHash: string;
  subaccountNumber: number;
  // The official docs list realizedPnl as fill-specific information.
  // If absent, this adapter fails loudly rather than infer P&L.
  realizedPnl?: string;
};

type DydxFillsResponse = {
  fills: DydxFill[];
};

type DydxFundingPayment = {
  market: string;
  payment: string;
  rate: string;
  positionSize: string;
  price: string;
  effectiveAt: string;
  effectiveAtHeight: string;
};

type DydxFundingResponse = {
  fundingPayments: DydxFundingPayment[];
};

// --- Fetch helpers ---

async function fetchFills(address: string): Promise<DydxFill[]> {
  const allFills: DydxFill[] = [];
  let createdBeforeOrAt: string | undefined = undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      address,
      subaccountNumber: "0",
      limit: PAGE_LIMIT.toString(),
    });
    if (createdBeforeOrAt) {
      params.set("createdBeforeOrAt", createdBeforeOrAt);
    }

    const url = `${INDEXER_BASE}/fills?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`dYdX Indexer API error (fills): ${response.status} — ${text}`);
    }

    const data: DydxFillsResponse = await response.json();
    const fills = data.fills;

    if (!fills || fills.length === 0) break;

    allFills.push(...fills);

    if (fills.length < PAGE_LIMIT) break;

    // Paginate using the createdAt of the oldest fill in this batch
    const oldest = fills[fills.length - 1];
    // Subtract 1ms to avoid re-fetching the same fill
    const oldestDate = new Date(oldest.createdAt);
    oldestDate.setMilliseconds(oldestDate.getMilliseconds() - 1);
    createdBeforeOrAt = oldestDate.toISOString();
  }

  return allFills;
}

async function fetchFundingPayments(address: string): Promise<DydxFundingPayment[]> {
  const allPayments: DydxFundingPayment[] = [];
  let effectiveBeforeOrAt: string | undefined = undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      address,
      subaccountNumber: "0",
      limit: PAGE_LIMIT.toString(),
    });
    if (effectiveBeforeOrAt) {
      params.set("effectiveBeforeOrAt", effectiveBeforeOrAt);
    }

    const url = `${INDEXER_BASE}/historicalFunding/${address}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Try the alternate endpoint path
      const altUrl = `${INDEXER_BASE}/fundingPayments?${params.toString()}`;
      const altResponse = await fetch(altUrl);
      if (!altResponse.ok) {
        const text = await altResponse.text();
        throw new Error(`dYdX Indexer API error (funding): ${altResponse.status} — ${text}`);
      }
      const altData: DydxFundingResponse = await altResponse.json();
      const payments = altData.fundingPayments;
      if (!payments || payments.length === 0) break;
      allPayments.push(...payments);
      if (payments.length < PAGE_LIMIT) break;
      const oldest = payments[payments.length - 1];
      const oldestDate = new Date(oldest.effectiveAt);
      oldestDate.setMilliseconds(oldestDate.getMilliseconds() - 1);
      effectiveBeforeOrAt = oldestDate.toISOString();
      continue;
    }

    const data: DydxFundingResponse = await response.json();
    const payments = data.fundingPayments;

    if (!payments || payments.length === 0) break;

    allPayments.push(...payments);

    if (payments.length < PAGE_LIMIT) break;

    const oldest = payments[payments.length - 1];
    const oldestDate = new Date(oldest.effectiveAt);
    oldestDate.setMilliseconds(oldestDate.getMilliseconds() - 1);
    effectiveBeforeOrAt = oldestDate.toISOString();
  }

  return allPayments;
}

// --- Normalization ---

function normalizeFill(fill: DydxFill, index: number): AwakensEvent {
  // Only perpetual fills
  if (fill.marketType !== "PERPETUAL") {
    throw new Error(
      `dYdX fill ${fill.id}: unexpected marketType "${fill.marketType}". ` +
      "This adapter only handles perpetual trades."
    );
  }

  const size = parseAndTruncate(fill.size, `fill[${index}].size`);
  const fee = truncateDecimals(Math.abs(parseAndTruncate(fill.fee, `fill[${index}].fee`)));

  // Determine open vs close using realizedPnl.
  // If realizedPnl is absent, we cannot determine trade type — fail loudly.
  let pnl: number;
  let isClose: boolean;

  if (fill.realizedPnl !== undefined && fill.realizedPnl !== null) {
    pnl = parseAndTruncate(fill.realizedPnl, `fill[${index}].realizedPnl`);
    // A fill with non-zero realized PnL is a close.
    // A fill with exactly 0 realized PnL is an open.
    // Edge case: break-even close also has pnl=0, tagged as open.
    // This is a known limitation of dYdX's data model.
    isClose = pnl !== 0;
  } else {
    throw new Error(
      `dYdX fill ${fill.id}: realizedPnl field is missing from API response. ` +
      "Cannot determine if this fill is an open or close without platform-reported realized P&L. " +
      "This adapter refuses to infer P&L."
    );
  }

  // Extract asset from market string (e.g., "ETH-USD" → "ETH")
  const asset = fill.market.split("-")[0];

  // Transaction hash: use the on-chain hash + fill ID for uniqueness
  const txHash = fill.transactionHash
    ? `${fill.transactionHash}-${fill.id}`
    : `dydx-fill-${fill.id}`;

  return {
    date: formatISODateUTC(fill.createdAt),
    asset,
    amount: size,
    fee,
    pnl: isClose ? pnl : 0,
    paymentToken: isClose ? "USDC" : "",
    notes: `${fill.side} ${fill.market} @ ${fill.price} (${fill.type}/${fill.liquidity})`,
    txHash,
    tag: isClose ? "close_position" : "open_position",
  };
}

function normalizeFunding(payment: DydxFundingPayment, index: number): AwakensEvent {
  const amount = parseAndTruncate(payment.payment, `funding[${index}].payment`);

  // Extract asset from market string
  const asset = payment.market.split("-")[0];

  // Generate a stable unique hash from market + effectiveAt + height
  const txHash = `dydx-funding-${payment.market}-${payment.effectiveAtHeight}`;

  return {
    date: formatISODateUTC(payment.effectiveAt),
    asset: "USDC",
    amount: truncateDecimals(Math.abs(amount)),
    fee: 0,
    pnl: amount,
    paymentToken: "USDC",
    notes: `Funding: ${asset} rate=${payment.rate} size=${payment.positionSize}`,
    txHash,
    tag: "funding_payment",
  };
}

// --- Adapter ---

export const dydxAdapter: PerpsAdapter = {
  id: "dydx",
  name: "dYdX v4",

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // dYdX v4 uses bech32 addresses starting with "dydx1"
    if (!account || !account.startsWith("dydx1")) {
      throw new Error(
        "Invalid dYdX v4 address. Must be a bech32 address starting with 'dydx1'."
      );
    }

    const [fills, funding] = await Promise.all([
      fetchFills(account),
      fetchFundingPayments(account),
    ]);

    const fillEvents = fills.map((f, i) => normalizeFill(f, i));
    const fundingEvents = funding.map((f, i) => normalizeFunding(f, i));

    const allEvents = [...fillEvents, ...fundingEvents].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return allEvents;
  },
};
