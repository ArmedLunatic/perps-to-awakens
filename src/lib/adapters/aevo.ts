import { PerpsAdapter } from "../core/types";

/**
 * Aevo adapter — STUB.
 *
 * Why this is not implemented:
 *   Aevo's trade history and funding history endpoints require API key
 *   authentication. This application is designed for read-only access
 *   using only a wallet address — no authentication credentials.
 *
 * Available endpoints (all require API key):
 *   - GET /trade-history — account trade fills
 *     Response fields: instrument_name, side, amount (6 decimals), price,
 *     fees, realized_pnl (signed float string), timestamp (nanoseconds),
 *     liquidity (maker/taker)
 *     Supports filtering by trade type: "trade", "liquidation", "settlement", "funding"
 *   - GET /funding-history — funding rate history per instrument
 *   - GET /account/transactions/csv — full account CSV export
 *   - SUBSCRIBE fills (WebSocket) — real-time fill events
 *
 * Authentication requirements:
 *   - API Key: Required for all account endpoints
 *   - Account address: Required alongside API key
 *   - No public endpoint to query by wallet address alone
 *
 * What would be needed to implement:
 *   1. Accept API key + API secret as input (or signing key)
 *   2. GET https://api.aevo.xyz/trade-history with auth headers
 *   3. GET https://api.aevo.xyz/funding-history for funding payments
 *   4. Parse instrument_name (e.g., "ETH-PERP") → asset symbol
 *   5. Use realized_pnl field directly (platform-reported)
 *   6. Timestamp is in nanoseconds — divide by 10^6 for ms
 *   7. Settlement token is USDC
 *
 * Positive notes:
 *   - Aevo DOES expose per-trade realized PnL (realized_pnl field)
 *   - Funding events are filterable via trade type parameter
 *   - Amount is in 6-decimal fixed point
 *   - Full implementation would be straightforward IF auth is available
 *
 * API base URLs:
 *   - Mainnet REST: https://api.aevo.xyz
 *   - Mainnet WebSocket: wss://ws.aevo.xyz
 *   - Testnet REST: https://api-testnet.aevo.xyz
 */
export const aevoAdapter: PerpsAdapter = {
  id: "aevo",
  name: "Aevo",

  async getEvents(): Promise<never> {
    throw new Error(
      "Aevo adapter is not implemented. " +
      "Aevo requires API key authentication for trade history endpoints. " +
      "This application only supports read-only access by wallet address. " +
      "See source comments for API details — implementation would be " +
      "straightforward if API credentials were accepted as input."
    );
  },
};
