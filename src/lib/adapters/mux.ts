import { PerpsAdapter } from "../core/types";

/**
 * MUX Protocol adapter — STUB.
 *
 * Why this is not implemented:
 *   MUX Protocol is a leverage trading aggregator that routes orders to
 *   underlying DEXs (GMX, Gains Network, etc.). Trade history and P&L
 *   are fragmented across multiple underlying protocols, making it
 *   impossible to reliably extract per-trade realized PnL from a single
 *   data source without cross-referencing multiple subgraphs.
 *
 * Available data sources:
 *   - MUX Subgraph (Arbitrum):
 *     Indexes aggregated position events
 *   - Underlying protocol subgraphs:
 *     GMX, Gains Network, etc. (each with different schemas)
 *
 * What would be needed to implement:
 *   1. Query MUX subgraph for aggregated position events
 *   2. Verify that realized PnL is reported at the MUX layer (not just underlying)
 *   3. Map MUX market symbols → standard asset symbols
 *   4. Handle fee aggregation across MUX fee + underlying protocol fee
 *   5. Determine funding payment source (MUX or underlying protocol)
 *
 * Known pitfalls:
 *   - P&L may only be available at the underlying protocol level
 *   - Fees are split between MUX and the underlying DEX
 *   - Position routing means a single MUX trade may span multiple protocols
 *   - Liquidation handling differs per underlying protocol
 *
 * Account: Ethereum address (0x...) for Arbitrum deployment.
 */
export const muxAdapter: PerpsAdapter = {
  id: "mux",
  name: "MUX Protocol",

  async getEvents(): Promise<never> {
    throw new Error(
      "Not implemented: insufficient realized P&L data. " +
      "MUX is a trading aggregator — P&L data is fragmented across " +
      "underlying protocols (GMX, Gains, etc.). " +
      "Cannot reliably extract per-trade realized PnL from a single source. " +
      "See source comments for details."
    );
  },
};
