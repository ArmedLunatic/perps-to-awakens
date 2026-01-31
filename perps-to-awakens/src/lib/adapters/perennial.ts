import { PerpsAdapter } from "../core/types";

/**
 * Perennial adapter — STUB.
 *
 * Perennial is an on-chain derivatives protocol on Arbitrum using an
 * intent-based architecture with a keeper network and Pyth/Chainlink oracles.
 *
 * Why this is not implemented:
 *   - No confirmed public subgraph endpoint with explicit per-trade realized PnL
 *   - The Perennial SDK (sdk-docs.perennial.finance) provides historicalPositions()
 *     and tradeHistory() methods, but these require SDK initialization with a
 *     private graphUrl parameter that is not publicly documented
 *   - AccumulationResult fields (pnl, collateral, funding, interest, fee) may
 *     exist in the subgraph schema but could not be verified against a live endpoint
 *   - Perennial's unique position model (maker/long/short deltas) means position
 *     classification cannot be safely done without understanding the full state
 *
 * What would be needed to implement:
 *   1. Confirmed subgraph URL for perennial-v2-subgraph on Arbitrum
 *   2. Verification that AccumulationResult.pnl is the explicit per-trade realized PnL
 *   3. Query AccountPositionProcessed events filtered to taker positions only
 *   4. Market ID → asset symbol mapping (ETH, BTC, SOL, etc.)
 *   5. DSU (Digital Standard Unit) as settlement token
 *   6. Ignore maker positions (different P&L model)
 *
 * Resources:
 *   - SDK docs: https://sdk-docs.perennial.finance/
 *   - SDK source: https://github.com/equilibria-xyz/perennial-v2-sdk-ts
 *   - Protocol: https://github.com/equilibria-xyz/perennial-v2
 *   - DSU docs: https://docs.dsu.money/
 *
 * Account: Ethereum address (0x...) on Arbitrum.
 */
export const perennialAdapter: PerpsAdapter = {
  id: "perennial",
  name: "Perennial",

  async getEvents(): Promise<never> {
    throw new Error(
      "Perennial adapter is not implemented. " +
        "No confirmed public subgraph endpoint with explicit per-trade realized PnL. " +
        "Perennial's SDK requires a private graphUrl for position history queries. " +
        "See source comments for details on what would be needed."
    );
  },
};
