# Perps to Awakens

Convert perpetuals trading history from multiple platforms into a CSV that imports cleanly into [Awakens](https://awakens.com) with zero manual edits.

## Supported Platforms

| Platform       | Status          | Address Format     | Limitations                                           |
|----------------|-----------------|--------------------|-------------------------------------------------------|
| Hyperliquid    | **Full**        | `0x...` (42 chars) | —                                                     |
| dYdX v4        | **Full**        | `dydx1...`         | Break-even closes tagged as opens (realizedPnl=0)     |
| GMX (Arbitrum) | **Full**        | `0x...` (42 chars) | No discrete funding events (embedded in closes)       |
| Jupiter Perps  | Stub            | Solana base58      | No trade history REST API; needs on-chain tx parsing  |
| Drift          | Stub            | Solana base58      | No per-trade realized PnL in API                      |
| Aevo           | Stub            | `0x...`            | Requires API key authentication                       |
| Vertex         | Stub            | `0x...`            | No per-trade realized PnL (only balance snapshots)    |
| MUX Protocol   | Stub            | `0x...`            | Aggregator — P&L fragmented across underlying DEXs    |
| Osmosis Perps  | Stub            | `osmo1...`         | No aggregated indexer; per-market CosmWasm queries     |
| Kwenta         | Stub            | `0x...`            | Synthetix funding model needs fundingIndex inference   |
| Synthetix v3   | Stub            | `0x...`            | Account NFT resolution + velocity funding model        |
| Perennial      | Stub            | `0x...`            | Unique maker/long/short position model                 |

### Why are some platforms stubbed?

This tool only exports data when the platform API provides **explicit, per-trade realized P&L**. It will not:

- Infer P&L from balance deltas or position snapshots
- Fabricate funding payment events
- Guess whether a trade is an open or close
- Produce data that requires manual correction

If a platform doesn't expose the required fields, the adapter throws an error explaining exactly what's missing.

## Awakens CSV Format

```
Date,Asset,Amount,Fee,P&L,Payment Token,Notes,Transaction Hash,Tag
```

- **Date**: `MM/DD/YYYY HH:MM:SS` (UTC)
- **Decimals**: Maximum 8 decimal places (truncated, not rounded)
- **Tag**: `open_position` | `close_position` | `funding_payment`
- **P&L**: Realized P&L only (0 for opens)
- **No duplicate Transaction Hash values**

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Next.js** (auto-detected)
4. No environment variables required
5. Deploy

Or use the CLI:

```bash
npx vercel
```

## How to Add a New Adapter

1. Create `src/lib/adapters/{platform}.ts`
2. Implement the `PerpsAdapter` interface:

```typescript
import { AwakensEvent, PerpsAdapter } from "../core/types";

export const myAdapter: PerpsAdapter = {
  id: "my-platform",
  name: "My Platform",
  async getEvents(account: string): Promise<AwakensEvent[]> {
    // 1. Validate account format
    // 2. Fetch from platform API (with pagination)
    // 3. Normalize each event to AwakensEvent
    // 4. Use truncateDecimals() from ./utils.ts (never round)
    // 5. Return validated events sorted by date
  },
};
```

3. Register in `src/lib/adapters/registry.ts`
4. Add to the `PLATFORMS` array in `src/app/page.tsx` with `ready: true`

### Normalization Rules

| Event Type       | amount         | pnl                | paymentToken | tag               |
|------------------|----------------|--------------------|--------------|-------------------|
| Open Position    | Position size  | 0                  | Optional     | `open_position`   |
| Close Position   | Closed size    | Realized P&L       | Required     | `close_position`  |
| Funding Payment  | Funding amount | = funding amount   | Required     | `funding_payment` |

### Correctness Rules

- Never infer P&L from balances or position deltas
- Never mix spot trades with perps
- Never auto-tag without platform data
- Never fabricate funding events
- If the platform does not expose a value, **throw an error**
- Truncate decimals to 8 places (never round)

## Architecture

```
src/
  lib/
    core/
      types.ts          # AwakensEvent, PerpsAdapter, ValidationError
      validation.ts     # Pre-export validation (date, precision, duplicates, tag rules)
      csv.ts            # CSV generation with strict header enforcement
    adapters/
      utils.ts          # Shared: formatDateUTC, truncateDecimals, paginateAll
      registry.ts       # Adapter registry
      hyperliquid.ts    # Full — Hyperliquid L1 API (fills + funding)
      dydx.ts           # Full — dYdX v4 Indexer (fills + funding payments)
      gmx.ts            # Full — GMX v2 Subsquid GraphQL (trade actions)
      jupiter.ts        # Stub — no trade history API
      drift.ts          # Stub — no per-trade realized PnL
      aevo.ts           # Stub — requires API key auth
      vertex.ts         # Stub — no per-trade realized PnL
      mux.ts            # Stub — aggregator, fragmented data
      osmosis.ts        # Stub — no aggregated indexer
      kwenta.ts         # Stub — Synthetix funding model
      synthetix.ts      # Stub — account NFT + velocity funding
      perennial.ts      # Stub — unique position model
  components/
    EventTable.tsx      # Sortable preview table with color-coded tags
  app/
    page.tsx            # Main UI (platform select → input → preview → export)
    api/events/route.ts # POST endpoint for fetching + validating events
    layout.tsx          # Root layout (dark mode)
```

## Known Limitations

### dYdX v4
- Break-even closes (realizedPnl = exactly 0) are tagged as `open_position` because the API doesn't distinguish opens from closes via a separate field. This is a data model limitation.
- If the dYdX Indexer stops including `realizedPnl` in fill responses, the adapter will throw an error rather than guess.

### GMX (Arbitrum)
- GMX does not emit discrete funding payment events. Borrowing and funding fees are settled atomically when positions change. No `funding_payment` rows are generated.
- Fee is reported as 0 because GMX fees (position fee + borrowing fee + funding fee) are already reflected in `basePnlUsd`. Reporting them separately would double-count.
- Market symbols depend on the GMX token info API. If the API is unavailable, shortened addresses are used as fallback.

### General
- All adapters paginate up to platform-specific limits (typically 50-100 pages). Accounts with extremely long histories may be truncated.
- Timestamps are converted to UTC. If a platform reports local time, the conversion may introduce offset errors.

## License

MIT
