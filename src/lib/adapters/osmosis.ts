import { PerpsAdapter } from "../core/types";

/**
 * Osmosis Perps adapter (Levana / Mars Protocol) — STUB.
 *
 * Why this is not implemented:
 *   Osmosis perps (via Levana or Mars) use CosmWasm contract queries
 *   for position data. There is no public REST indexer for historical
 *   trade events with per-trade realized PnL.
 *
 * Levana (CosmWasm):
 *   - Contract: osmosis1... (Levana perps market contract per market)
 *   - Query: { "trade_history": { "owner": "osmo1...", "start_after": null, "limit": 100 } }
 *   - Returns: entries with open_price, close_price, pnl, direction, collateral, timestamp
 *   - Funding: embedded in position updates via borrow_fee and funding_rate fields
 *   - LCD endpoint: https://lcd.osmosis.zone/cosmwasm/wasm/v1/contract/{addr}/smart/{query}
 *   - NOTE: trade_history availability depends on the specific Levana deployment
 *     and may not be supported on all markets.
 *
 * Mars Protocol:
 *   - Mars credit account perps (limited availability)
 *   - Position data via Mars contract queries
 *   - Realized PnL availability unconfirmed
 *
 * Known pitfalls:
 *   - Need to query each market contract separately (no aggregated endpoint)
 *   - Funding is continuous, not discrete hourly payments
 *   - Settlement token varies per market (USDC, OSMO, ATOM, etc.)
 *   - Transaction hashes are Cosmos tx hashes (64-char hex uppercase)
 *   - Positions may have partial closes
 *   - CosmWasm query encoding: base64(JSON) in URL
 *
 * Account: Osmosis bech32 address (osmo1...).
 */
export const osmosisAdapter: PerpsAdapter = {
  id: "osmosis",
  name: "Osmosis Perps",

  async getEvents(): Promise<never> {
    throw new Error(
      "Not implemented: insufficient realized P&L data. " +
      "Osmosis perps (Levana/Mars) use CosmWasm contract queries " +
      "with per-market contracts. No aggregated indexer available. " +
      "See source comments for CosmWasm query format."
    );
  },
};
