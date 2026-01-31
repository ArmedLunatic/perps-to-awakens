import { PerpsAdapter } from "../core/types";

/**
 * Drift Protocol adapter — STUB.
 *
 * Why this is not implemented:
 *   Drift's fill/trade events do not include per-trade realized PnL.
 *   The `realizedPnl` and `settledPnl` fields exist on the on-chain
 *   PerpPosition struct (cumulative), not on individual fill records.
 *   Reconstructing per-trade P&L would require computing position deltas,
 *   which violates the "do not infer P&L from balances" rule.
 *
 *   Additionally, Drift's historical data API requires a subaccount public key
 *   (not a wallet address), adding UX friction.
 *
 * Available data sources:
 *   1. Data API: data.api.drift.trade/playground
 *      - Fill events: side, fee, amount, price, orderId, marketIndex, ts, signature
 *      - Missing: per-fill realized PnL
 *   2. S3 Historical Data (DEPRECATED Jan 2025):
 *      - URL: drift-historical-data-v2.s3.eu-west-1.amazonaws.com/program/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH/
 *      - Paths: user/{subaccountKey}/tradeRecords/{year}/{date}
 *      - Paths: user/{subaccountKey}/fundingPaymentRecords/{year}/{date}
 *   3. Gateway (self-hosted): github.com/drift-labs/gateway
 *      - REST: /v2/positions, /v2/orders
 *      - WebSocket: fill event subscriptions
 *   4. SDK (TypeScript/Python):
 *      - driftClient.settlePNL() for settlement
 *      - EventSubscriber for FundingPaymentRecord events
 *
 * What would be needed to implement:
 *   1. Confirm Data API returns per-trade realized PnL (not just cumulative)
 *   2. Map marketIndex → asset symbol
 *   3. Handle subaccount key resolution from wallet address
 *   4. Parse funding payment records separately
 *   5. Decimal precision: amounts stored as integers (PRICE_PRECISION = 10^6)
 *
 * Known pitfalls:
 *   - Subaccount key ≠ wallet authority
 *   - Multiple subaccounts per wallet
 *   - P&L settlement is async (settled vs realized distinction)
 *   - Funding payments use continuous rates, settled on position change
 *
 * Solana wallet address format: base58, 32-44 chars.
 */
export const driftAdapter: PerpsAdapter = {
  id: "drift",
  name: "Drift",

  async getEvents(): Promise<never> {
    throw new Error(
      "Drift adapter is not implemented. " +
      "Drift's fill events do not include per-trade realized PnL — " +
      "only cumulative position PnL is available on-chain. " +
      "Inferring per-trade P&L from position deltas would violate " +
      "accounting correctness requirements. " +
      "See source comments for technical details."
    );
  },
};
