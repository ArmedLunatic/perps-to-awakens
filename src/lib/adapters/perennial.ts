import { PerpsAdapter } from "../core/types";

/**
 * Perennial adapter — STUB (Tier 3, no logic).
 *
 * Perennial is an on-chain derivatives protocol deployed on Arbitrum.
 * It uses an intent-based architecture with a keeper network.
 *
 * Expected endpoints:
 *   - Perennial Subgraph (Arbitrum):
 *     Entities: AccountPositionProcessed, Updated, Liquidation,
 *     PositionOpened, PositionClosed
 *   - Perennial SDK (@perennial/sdk):
 *     Provides typed access to market and position data
 *
 * Event types needed:
 *   - AccountPositionProcessed: account, market, fromPosition, toPosition,
 *     accumulationResult (collateral, pnl, funding, interest, fee)
 *   - Updated: account, market, order (maker/long/short delta), collateral
 *   - Liquidation: account, market, liquidator, fee
 *
 * Known pitfalls:
 *   - Perennial uses a unique position accounting model:
 *     Positions are "maker", "long", or "short" with separate deltas
 *   - P&L is computed in AccumulationResult which includes:
 *     collateral change, realized PnL, accrued funding, accrued interest, fees
 *     These are all separate fields, but they're settled together
 *   - Partial close: toPosition.magnitude < fromPosition.magnitude
 *   - Funding is continuous (accumulated per oracle update)
 *   - Interest accrual is separate from funding
 *   - DSU (Digital Standard Unit) is the collateral token
 *   - Market IDs must be resolved to asset symbols
 *   - Oracle-based settlement (Pyth, Chainlink)
 *
 * Account: Ethereum address (0x...) on Arbitrum.
 */
export const perennialAdapter: PerpsAdapter = {
  id: "perennial",
  name: "Perennial",

  async getEvents(): Promise<never> {
    throw new Error(
      "Perennial adapter is not implemented. " +
      "Requires subgraph integration with Perennial's unique position model " +
      "(maker/long/short deltas) and AccumulationResult parsing. " +
      "See source comments for endpoint details and known pitfalls."
    );
  },
};
