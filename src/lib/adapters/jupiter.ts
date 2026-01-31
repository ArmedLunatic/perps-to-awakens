import { PerpsAdapter } from "../core/types";

/**
 * Jupiter Perps adapter — STUB.
 *
 * Why this is not implemented:
 *   Jupiter Perpetuals does not expose a REST API for trade history.
 *   Position data lives on-chain in Solana accounts and must be reconstructed
 *   by parsing Solana program transaction logs for the Jupiter Perps program
 *   (PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu).
 *
 *   The official Perps API (dev.jup.ag/docs/perps) is documented as
 *   "still a work in progress" and does not provide trade history.
 *
 * Missing data:
 *   - No REST endpoint for historical trades/fills
 *   - `realisedPnlUsd` on Position account resets to 0 on full close
 *   - No discrete funding rates (uses borrow fees instead)
 *   - Would require a Solana transaction log parser / indexer
 *
 * What would be needed to implement:
 *   1. Solana RPC connection to fetch all program transactions for the user
 *   2. Anchor IDL for Jupiter Perps to decode instruction data
 *   3. Parse IncreasePosition / DecreasePosition / ClosePosition instructions
 *   4. Extract realisedPnlUsd, collateral changes, borrow fees from logs
 *   5. Map collateral tokens (SOL for longs, USDC/USDT for shorts)
 *
 * On-chain account types:
 *   - Position: sizeUsd (6 decimals), collateralUsd, price (entry), realisedPnlUsd
 *   - PositionRequest: requestType (Increase/Decrease/Close), sizeUsdDelta
 *   - Custody: cumulative borrow rates
 *
 * Reference implementation for parsing:
 *   github.com/julianfssen/jupiter-perps-anchor-idl-parsing
 *
 * Solana wallet address format: base58, 32-44 chars.
 */
export const jupiterAdapter: PerpsAdapter = {
  id: "jupiter",
  name: "Jupiter Perps",

  async getEvents(): Promise<never> {
    throw new Error(
      "Jupiter Perps adapter is not implemented. " +
      "Jupiter does not expose a REST API for trade history. " +
      "Implementation requires parsing Solana on-chain transaction logs, " +
      "which is beyond the scope of a client-side adapter. " +
      "See source comments for technical requirements."
    );
  },
};
