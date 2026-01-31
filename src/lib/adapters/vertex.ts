import { PerpsAdapter } from "../core/types";

/**
 * Vertex Protocol adapter — STUB.
 *
 * Why this is not implemented:
 *   Vertex's match/fill events do not include a per-trade realized PnL field.
 *   The archive API provides pre_balance and post_balance snapshots per match event,
 *   but computing P&L from balance deltas would require position state tracking,
 *   which violates the "do not infer P&L from balances" rule.
 *
 * Available data sources:
 *   - Archive (Indexer) API:
 *     POST https://archive.prod.vertexprotocol.com/v1
 *     All requests are JSON payloads with Accept-Encoding: gzip/br/deflate
 *
 *   - Events endpoint: query match_orders events
 *     Fields: subaccount, product_id, submission_idx, event_type,
 *     pre_balance, post_balance (with amount, last_cumulative_multiplier),
 *     product state (oracle price, risk params)
 *     Filter by: subaccount, product_ids, event_types, max_time, limit
 *
 *   - Interest & Funding Payments endpoint:
 *     Returns per-user funding and interest payments
 *
 *   - Settlement events: getPaginatedSubaccountSettlementEvents()
 *     Returns SettlePnl events (aggregate, not per-trade)
 *
 * What would be needed to implement:
 *   1. Confirm Vertex exposes per-trade realized PnL (not just balance deltas)
 *   2. Query match_orders events by subaccount
 *   3. Map product_id → asset symbol
 *   4. Query funding payments separately
 *   5. Subaccount format: hex string
 *   6. Vertex uses cross-margin; all positions share collateral
 *
 * Known pitfalls:
 *   - Pre/post balance deltas include unrealized PnL changes (not just realized)
 *   - Vertex subaccount ≠ wallet address (need to derive)
 *   - Funding payments are continuous, settled on interaction
 *   - Token amounts use 18-decimal precision
 *
 * Account: Ethereum address (0x...) for Arbitrum deployment.
 */
export const vertexAdapter: PerpsAdapter = {
  id: "vertex",
  name: "Vertex",

  async getEvents(): Promise<never> {
    throw new Error(
      "Not implemented: insufficient realized P&L data. " +
      "Vertex match events provide balance snapshots but no per-trade realized PnL. " +
      "Computing P&L from balance deltas would require position state inference. " +
      "See source comments for API details."
    );
  },
};
