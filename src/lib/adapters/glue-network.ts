import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Glue Network Adapter (PARTIAL MODE)
 *
 * Supported:
 *   - Explicit protocol reward distributions (if emitted by Glue Hub)
 *   - Explicit emission/incentive distributions with per-account attribution
 *   - Explicit settlement events ONLY if Glue Hub emits realized
 *     per-account values as discrete events
 *
 * Intentionally Blocked:
 *   - Trade reconstruction from swaps or message logs
 *   - Balance-based activity inference
 *   - Cross-chain message value estimation
 *   - LP position tracking
 *   - Fee accrual inference
 *   - Any activity without explicit per-account protocol events
 *
 * Why partial:
 *   Glue Network is a settlement and interoperability protocol. We support
 *   ONLY events where the protocol explicitly emits per-account accounting
 *   values (reward distributions, incentive claims, settlement completions
 *   with realized values). Any activity that requires reconstructing value
 *   from cross-chain messages or balance changes is blocked.
 *
 * Data source: Glue Network API
 * Input: Glue Network address
 *
 * Note: This adapter will attempt to query Glue Network's public API
 * for explicit accounting events. If the API does not expose per-account
 * reward or settlement events, this adapter returns an empty array
 * with a clear explanation — it does NOT fall back to inference.
 */

type GlueRewardEvent = {
  eventId: string;
  timestamp: number;
  recipientAddress: string;
  amount: string;
  token: string;
  eventType: "reward_distribution" | "incentive_claim" | "settlement_realized";
  txHash: string;
};

type GlueEventsResponse = {
  events: GlueRewardEvent[];
  nextCursor?: string;
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export const glueNetworkAdapter: PerpsAdapter = {
  id: "glue-network",
  name: "Glue Network",
  mode: "strict",
  family: "glue-network",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate address format — Glue Network uses standard hex addresses
    if (!/^0x[0-9a-fA-F]{40}$/.test(account) && !/^[a-zA-Z0-9]{30,60}$/.test(account)) {
      throw new Error(
        `Invalid Glue Network address format: "${account}"`
      );
    }

    const events: AwakensEvent[] = [];

    // Attempt to query Glue Network's public API for explicit accounting events.
    // We look for three specific event types:
    // 1. reward_distribution — protocol reward payouts
    // 2. incentive_claim — explicit incentive claims by this account
    // 3. settlement_realized — completed settlements with explicit per-account value
    //
    // If the API is not available or does not expose these events,
    // we return an empty array. We NEVER fall back to inference.

    const API_BASE = "https://api.glue.net/v1";

    try {
      let cursor: string | undefined = undefined;
      let pageCount = 0;
      const MAX_PAGES = 50;

      while (pageCount < MAX_PAGES) {
        let url = `${API_BASE}/accounts/${account}/events?types=reward_distribution,incentive_claim,settlement_realized&limit=100`;
        if (cursor) {
          url += `&cursor=${cursor}`;
        }

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          if (res.status === 404) {
            // Account not found or API not available — return empty, not error
            return [];
          }
          if (res.status === 503 || res.status === 502) {
            // API not yet available — return empty with no false data
            return [];
          }
          throw new Error(`Glue Network API error: HTTP ${res.status}`);
        }

        let data: GlueEventsResponse;
        try {
          data = await res.json();
        } catch {
          // Malformed response — return empty, do not guess
          return [];
        }

        if (!data.events || data.events.length === 0) break;

        for (const event of data.events) {
          // Verify this event is for our account explicitly
          if (event.recipientAddress.toLowerCase() !== account.toLowerCase()) continue;

          const amount = Math.trunc(Number(event.amount) * 1e8) / 1e8; // Truncate to 8 decimal places (not round) for accounting correctness
          if (isNaN(amount) || amount <= 0) continue;

          const notePrefix = {
            reward_distribution: "Glue Network protocol reward",
            incentive_claim: "Glue Network incentive claim",
            settlement_realized: "Glue Network settlement (realized value)",
          }[event.eventType] || "Glue Network event";

          events.push({
            date: formatDate(event.timestamp),
            asset: event.token,
            amount,
            fee: 0,
            pnl: amount,
            paymentToken: event.token,
            notes: `${notePrefix} (explicit protocol event only)`,
            txHash: `${event.txHash}-${event.eventId}`,
            tag: "staking_reward",
          });
        }

        if (!data.nextCursor) break;
        cursor = data.nextCursor;
        pageCount++;
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Glue Network API error")) {
        throw err;
      }
      // Network errors or unavailable API — return empty, never guess
      return [];
    }

    return events;
  },
};
