import { PerpsAdapter } from "../core/types";

/**
 * Synthetix v3 Perps adapter — STUB (Tier 3, no logic).
 *
 * Synthetix v3 is the next-generation protocol powering perps on Base and
 * Optimism. It replaces the Synthetix v2 perps system used by Kwenta.
 *
 * Expected endpoints:
 *   - Synthetix v3 Perps Subgraph (Base):
 *     Entities: PositionOpened, PositionClosed, PositionLiquidated,
 *     MarketUpdated, FundingParametersSet
 *   - Synthetix v3 Core Subgraph:
 *     Account, Collateral, Market entities
 *   - Cannon deployment data for contract addresses
 *
 * Event types needed:
 *   - PositionOpened: account, marketId, sizeDelta, acceptablePrice, commitmentTime
 *   - PositionClosed: marketId, accountId, fillPrice, pnl, accruedFunding, sizeDelta
 *   - OrderSettled: marketId, accountId, fillPrice, pnl, accruedFunding,
 *     sizeDelta, settlementReward, trackingCode
 *   - FundingRecomputed: marketId, skew, fundingRate, fundingVelocity
 *
 * Known pitfalls:
 *   - Synthetix v3 uses account IDs (uint128), not wallet addresses directly
 *     A wallet owns account NFTs; must resolve wallet → accountIds first
 *   - Funding is velocity-based (not fixed rate), accrued continuously
 *   - Per-user funding payments are embedded in OrderSettled.accruedFunding
 *   - Partial close P&L is in OrderSettled.pnl (platform-reported)
 *   - Settlement rewards (keeper incentives) complicate fee accounting
 *   - Multiple collateral types possible per account
 *   - sUSD / snxUSD is the settlement token
 *   - Market IDs must be resolved to asset symbols via MarketProxy
 *
 * Account: Ethereum address (0x...) on Base/Optimism.
 * Must resolve wallet → Synthetix account IDs via AccountProxy NFT ownership.
 */
export const synthetixAdapter: PerpsAdapter = {
  id: "synthetix",
  name: "Synthetix v3",

  async getEvents(): Promise<never> {
    throw new Error(
      "Synthetix v3 adapter is not implemented. " +
      "Requires account NFT resolution (wallet → accountIds), " +
      "subgraph integration, and velocity-based funding reconstruction. " +
      "See source comments for endpoint details and known pitfalls."
    );
  },
};
