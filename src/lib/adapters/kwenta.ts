import { PerpsAdapter } from "../core/types";

/**
 * Kwenta adapter — STUB (Tier 3, no logic).
 *
 * Kwenta is a decentralized derivatives trading platform built on Synthetix.
 * Deployed on Optimism and Base.
 *
 * Expected endpoints:
 *   - Kwenta Subgraph (Optimism):
 *     Indexes FuturesPosition, FuturesTrade entities
 *   - Synthetix Perps v2 Subgraph:
 *     positionModifieds, positionLiquidateds, fundingRateUpdates
 *   - Kwenta API / SDK:
 *     @kwenta/sdk provides typed access to position history
 *
 * Event types needed:
 *   - PositionModified (open, increase, decrease, close)
 *     Fields: id, account, market, margin, size, tradeSize, lastPrice,
 *     fundingIndex, fee, timestamp, txHash, isLiquidation, realizedPnl
 *   - FundingRateUpdate (per-market funding snapshots)
 *     Note: Funding is accrued continuously per Synthetix model, settled
 *     on position modification. Per-user funding payments require
 *     computing from fundingIndex deltas × position size.
 *
 * Known pitfalls:
 *   - Funding is NOT a discrete payment event on Kwenta/Synthetix
 *     It's accrued via a fundingIndex, and the delta is settled when
 *     the user modifies their position. Fabricating separate funding
 *     events requires computing (currentFundingIndex - lastFundingIndex) × size,
 *     which is balance inference.
 *   - Partial closes: tradeSize < position.size
 *   - Liquidations: isLiquidation flag on PositionModified
 *   - Fee structure: exchange fee + keeper fee (for delayed orders)
 *   - Cross-margin vs isolated margin modes
 *   - sUSD is the settlement token (Synthetix stablecoin)
 *
 * Account: Ethereum address (0x...) on Optimism/Base.
 */
export const kwentaAdapter: PerpsAdapter = {
  id: "kwenta",
  name: "Kwenta",

  async getEvents(): Promise<never> {
    throw new Error(
      "Kwenta adapter is not implemented. " +
      "Built on Synthetix Perps — requires subgraph integration and " +
      "funding payment reconstruction from fundingIndex deltas. " +
      "See source comments for endpoint details and known pitfalls."
    );
  },
};
