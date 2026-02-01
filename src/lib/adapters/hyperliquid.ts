import { AwakensEvent, PerpsAdapter } from "../core/types";
import { fetchWithContext } from "./utils";

const API_BASE = "https://api.hyperliquid.xyz/info";

/**
 * Raw fill from Hyperliquid API.
 */
type HyperliquidFill = {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  dir: string;
  closedPnl: string;
  fee: string;
  feeToken: string;
  tid: number;
  oid: number;
  hash: string;
};

/**
 * Raw funding delta from Hyperliquid API.
 */
type HyperliquidFundingEntry = {
  time: number;
  hash: string;
  delta: {
    coin: string;
    fundingRate: string;
    szi: string;
    type: "funding";
    usdc: string;
  };
};

/**
 * Format a UTC timestamp (ms) to MM/DD/YYYY HH:MM:SS.
 */
function formatDate(timestampMs: number): string {
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
 * Clamp a number to at most 8 decimal places using truncation (not rounding)
 * to avoid introducing accounting errors.
 */
function clampDecimals(n: number): number {
  return Math.trunc(n * 1e8) / 1e8;
}

/**
 * Determine if a fill is an open or close based on the `dir` field.
 * Hyperliquid dir values: "Open Long", "Open Short", "Close Long", "Close Short"
 */
function isClose(dir: string): boolean {
  return dir.startsWith("Close");
}

/**
 * Fetch all user fills, paginating backward through time to get full history.
 * Hyperliquid returns max 2000 fills per request.
 */
async function fetchAllFills(account: string): Promise<HyperliquidFill[]> {
  const allFills: HyperliquidFill[] = [];
  let endTime = Date.now();
  const MAX_PAGES = 50; // Safety limit: 50 * 2000 = 100k fills max

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchWithContext(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userFillsByTime",
        user: account,
        startTime: 0,
        endTime,
        aggregateByTime: false,
      }),
    }, "Hyperliquid");

    if (!response.ok) {
      throw new Error(`Hyperliquid API error (fills): ${response.status} ${response.statusText}`);
    }

    const fills: HyperliquidFill[] = await response.json();

    if (fills.length === 0) break;

    allFills.push(...fills);

    // If we got fewer than 2000, we've reached the end
    if (fills.length < 2000) break;

    // Set endTime to 1ms before the oldest fill in this batch
    const oldestTime = Math.min(...fills.map((f) => f.time));
    endTime = oldestTime - 1;
  }

  return allFills;
}

/**
 * Fetch all funding payments, paginating backward through time.
 */
async function fetchAllFunding(account: string): Promise<HyperliquidFundingEntry[]> {
  const allFunding: HyperliquidFundingEntry[] = [];
  let endTime = Date.now();
  const MAX_PAGES = 50;

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetchWithContext(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "userFunding",
        user: account,
        startTime: 0,
        endTime,
      }),
    }, "Hyperliquid");

    if (!response.ok) {
      throw new Error(`Hyperliquid API error (funding): ${response.status} ${response.statusText}`);
    }

    const entries: HyperliquidFundingEntry[] = await response.json();

    if (entries.length === 0) break;

    allFunding.push(...entries);

    if (entries.length < 2000) break;

    const oldestTime = Math.min(...entries.map((e) => e.time));
    endTime = oldestTime - 1;
  }

  return allFunding;
}

/**
 * Normalize a Hyperliquid fill into an AwakensEvent.
 */
function normalizeFill(fill: HyperliquidFill): AwakensEvent {
  const close = isClose(fill.dir);
  const size = clampDecimals(Math.abs(parseFloat(fill.sz)));
  const fee = clampDecimals(Math.abs(parseFloat(fill.fee)));
  const closedPnl = clampDecimals(parseFloat(fill.closedPnl));

  return {
    date: formatDate(fill.time),
    asset: fill.coin,
    amount: size,
    fee,
    pnl: close ? closedPnl : 0,
    paymentToken: close ? "USDC" : "",
    notes: `${fill.dir} @ ${fill.px}`,
    txHash: fill.hash ? `${fill.hash}-${fill.tid}` : `fill-${fill.tid}`,
    tag: close ? "close_position" : "open_position",
  };
}

/**
 * Normalize a Hyperliquid funding entry into an AwakensEvent.
 */
function normalizeFunding(entry: HyperliquidFundingEntry): AwakensEvent {
  const usdcAmount = clampDecimals(parseFloat(entry.delta.usdc));

  return {
    date: formatDate(entry.time),
    asset: "USDC",
    amount: clampDecimals(Math.abs(usdcAmount)),
    fee: 0,
    pnl: usdcAmount,
    paymentToken: "USDC",
    notes: `Funding: ${entry.delta.coin} rate=${entry.delta.fundingRate} size=${entry.delta.szi}`,
    txHash: entry.hash ? `${entry.hash}-funding-${entry.time}` : `funding-${entry.delta.coin}-${entry.time}`,
    tag: "funding_payment",
  };
}

/**
 * Hyperliquid perpetuals adapter.
 * Fetches fills and funding payments, normalizes to AwakensEvent format.
 */
export const hyperliquidAdapter: PerpsAdapter = {
  id: "hyperliquid",
  name: "Hyperliquid",

  async getEvents(account: string): Promise<AwakensEvent[]> {
    if (!account || !account.startsWith("0x") || account.length !== 42) {
      throw new Error("Invalid Ethereum address. Must be a 42-character hex address starting with 0x.");
    }

    const [fills, funding] = await Promise.all([
      fetchAllFills(account),
      fetchAllFunding(account),
    ]);

    // Hyperliquid API only returns the 10,000 most recent fills.
    // If we hit the pagination cap (MAX_PAGES * 2000), results are truncated.
    const MAX_FILLS = 50 * 2000; // MAX_PAGES * page size
    const fillsTruncated = fills.length >= MAX_FILLS;
    const fundingTruncated = funding.length >= MAX_FILLS;

    const fillEvents = fills.map(normalizeFill);
    const fundingEvents = funding.map(normalizeFunding);

    // Add truncation warning as a note on the first event if applicable
    if ((fillsTruncated || fundingTruncated) && fillEvents.length > 0) {
      fillEvents[0] = {
        ...fillEvents[0],
        notes: `[WARNING: Results may be truncated — API limit reached] ${fillEvents[0].notes}`,
      };
    }

    // Combine and sort by date ascending
    const allEvents = [...fillEvents, ...fundingEvents].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    return allEvents;
  },
};
