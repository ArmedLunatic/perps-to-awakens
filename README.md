# Perps to Awakens

Convert perpetuals trading history, staking rewards, and protocol events from multiple platforms into a CSV that imports cleanly into [Awakens](https://awakens.com) with zero manual edits.

## Supported Platforms

### Perpetuals Trading

| Platform       | Status          | Address Format     | Mode   | Limitations                                           |
|----------------|-----------------|--------------------|--------|-------------------------------------------------------|
| Hyperliquid    | **Full**        | `0x...` (42 chars) | Strict | —                                                     |
| dYdX v4        | **Full**        | `dydx1...`         | Strict | Break-even closes tagged as opens (realizedPnl=0)     |
| GMX (Arbitrum) | **Full**        | `0x...` (42 chars) | Strict | No discrete funding events (embedded in closes)       |
| Aevo           | **Full**        | `0x...` (42 chars) | Strict | Requires API key + secret (read-only key recommended) |
| Kwenta         | **Close-only**  | `0x...` (42 chars) | Strict | Closes only; no opens or funding (subgraph, Optimism) |
| Levana         | **Full**        | `osmo1.../inj1...` | Assisted | Events may require manual review                    |

### Staking & Protocol Rewards

| Platform / Chain     | Status   | Mode    | Scope                                            |
|----------------------|----------|---------|--------------------------------------------------|
| Polkadot, Kusama, Westend, Rococo, Statemint, Statemine, Bittensor, HydraDX, Astar, Shiden, Moonbeam, Moonriver | **Full** | Strict | Staking rewards & slashing via Subscan |
| Cosmos Hub, Osmosis, Neutron, Juno, Stride, Akash, Secret Network | **Full** | Strict | Staking rewards & slashing via LCD |
| Tezos              | **Full** | Strict  | Baking, delegation rewards, slashing              |
| NEAR Protocol      | **Full** | Strict  | Staking rewards & slashing via Nearblocks         |
| Algorand           | **Full** | Strict  | Participation rewards via Indexer API              |
| Avalanche P-Chain  | **Full** | Strict  | Validator/delegator rewards via Glacier API        |
| Cardano            | **Full** | Partial | Reward withdrawals only (requires Blockfrost key) |
| Ethereum Validator | **Full** | Partial | Consensus-layer rewards only (no EL, MEV)         |
| Solana             | **Full** | Partial | Epoch reward credits only (no balance inference)   |
| Kadena             | **Full** | Partial | Explicit coinbase rewards only                     |
| Aptos              | **Full** | Partial | Explicit staking reward events only                |
| Sui                | **Full** | Partial | Staking reward withdrawals only                    |
| Glue Network       | **Full** | Partial | Protocol rewards & settlement events only          |

### Blocked Platforms (Not Implemented)

| Platform       | Reason                                                |
|----------------|-------------------------------------------------------|
| Jupiter Perps  | No trade history REST API; needs on-chain tx parsing  |
| Drift          | No per-trade realized PnL in API                      |
| Vertex         | No per-trade realized PnL (only balance snapshots)    |
| MUX Protocol   | Aggregator — P&L fragmented across underlying DEXs    |
| Osmosis Perps  | No aggregated indexer; per-market CosmWasm queries     |
| Synthetix v3   | Account NFT resolution + velocity funding model        |
| Perennial      | No public subgraph with explicit per-trade PnL         |
| Mars           | No confirmed per-trade realized PnL                    |

### Why are some platforms blocked?

This tool only exports data when the platform API provides **explicit, per-event accounting data**. It will not:

- Infer P&L from balance deltas or position snapshots
- Fabricate funding payment events
- Guess whether a trade is an open or close
- Produce data that requires manual correction

If a platform doesn't expose the required fields, it is blocked by design with a clear explanation.

## Modes

| Mode | Meaning | Platforms |
|------|---------|-----------|
| **Strict** | Platform emits explicit, unambiguous accounting events. Export immediately. | Hyperliquid, dYdX, GMX, Aevo, Kwenta, all Substrate, all Cosmos, Tezos, NEAR, Algorand, Avalanche |
| **Assisted** | Events may require manual review for accuracy. | Levana |
| **Partial** | Limited but verifiable subset of events. Inference-based activity intentionally blocked. | Cardano, Ethereum Validator, Solana, Kadena, Aptos, Sui, Glue Network |

## Error Recovery System

Every error in the product is classified and provides explicit recovery guidance. There are zero dead-end errors.

### Error Classifications

| Type | Classification | Recovery |
|------|---------------|----------|
| Network failure | USER-FIXABLE | "Check your internet connection and retry" + Retry button |
| Rate limit (429) | USER-FIXABLE | "Wait a few minutes, then retry" + Retry button |
| Auth failure (401/403) | USER-FIXABLE | "Check your API key and secret, then retry" |
| Invalid address format | USER-FIXABLE | "Check the address format and correct it" |
| Empty results | USER-FIXABLE | "Try different account" / "Edit address" buttons |
| Truncated results | MODE-FIXABLE | Prominent amber banner explaining partial history |
| Adapter not implemented | SYSTEM-BLOCKED | "Blocked by design — protocol limitation, no workaround" |
| Validation errors in data | SYSTEM-BLOCKED | "System-level validation failure — cannot be resolved by changing input" |

### Structured Error Model

All API error responses include a `classified` object:

```typescript
type ClassifiedError = {
  type: "network" | "rate-limit" | "auth" | "validation" | "blocked-by-design" | "internal";
  reason: string;
  userAction?: string;        // what the user can do (if anything)
  blockedByDesign: boolean;   // true = protocol limitation, no workaround
};
```

## Awakens CSV Format

```
Date,Asset,Amount,Fee,P&L,Payment Token,Notes,Transaction Hash,Tag
```

- **Date**: `MM/DD/YYYY HH:MM:SS` (UTC)
- **Decimals**: Maximum 8 decimal places (truncated, not rounded)
- **Tag**: `open_position` | `close_position` | `funding_payment` | `staking_reward` | `slashing`
- **P&L**: Realized P&L only (0 for opens)
- **No duplicate Transaction Hash values**

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm test
```

Runs validation tests (95 cases) and adversarial tests (18 cases) covering: date edge cases, decimal precision, NaN/Infinity guards, CSV injection prevention, adapter ID uniqueness, and stub adapter rejection.

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
  mode: "strict",           // "strict" | "assisted"
  family: "my-family",      // for UI grouping
  supports: ["staking_reward", "slashing"],
  blocks: ["open_position"],
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
5. If partial/assisted, add to `PLATFORM_MODES` in `src/app/page.tsx`
6. If the platform has specific supported/blocked data, add to `PLATFORM_DOCS`

### Normalization Rules

| Event Type       | amount         | pnl                | paymentToken | tag               |
|------------------|----------------|--------------------|--------------|-------------------|
| Open Position    | Position size  | 0                  | Optional     | `open_position`   |
| Close Position   | Closed size    | Realized P&L       | Required     | `close_position`  |
| Funding Payment  | Funding amount | = funding amount   | Required     | `funding_payment` |
| Staking Reward   | Reward amount  | > 0                | Required     | `staking_reward`  |
| Slashing         | Penalty amount | < 0                | Required     | `slashing`        |

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
      types.ts          # AwakensEvent, PerpsAdapter, ValidationError, ClassifiedError
      validation.ts     # Pre-export validation (date, precision, duplicates, tag rules)
      csv.ts            # CSV generation with strict header enforcement
    adapters/
      utils.ts          # Shared: formatDateUTC, truncateDecimals, fetchWithContext, paginateAll
      registry.ts       # Adapter registry (48 adapters)
      hyperliquid.ts    # Full — Hyperliquid L1 API (fills + funding)
      dydx.ts           # Full — dYdX v4 Indexer (fills + funding payments)
      gmx.ts            # Full — GMX v2 Subsquid GraphQL (trade actions)
      aevo.ts           # Full — Aevo REST API (requires API key + secret)
      kwenta.ts         # Close-only — Kwenta subgraph (Optimism)
      levana.ts         # Full — Levana CosmWasm perps (Assisted mode)
      substrate-staking.ts  # 12 Substrate chains via Subscan
      cosmos-staking.ts     # 7 Cosmos chains via LCD
      tezos-staking.ts      # Tezos via TzKT
      cardano-staking.ts    # Cardano via Blockfrost (Partial)
      near-staking.ts       # NEAR via Nearblocks
      eth-validators.ts     # Ethereum CL via Beaconcha.in (Partial)
      algorand-staking.ts   # Algorand via Indexer API
      avalanche-staking.ts  # Avalanche P-Chain via Glacier API
      solana-staking.ts     # Solana via RPC (Partial)
      kadena-staking.ts     # Kadena via block explorer (Partial)
      aptos-staking.ts      # Aptos via Aptos API (Partial)
      sui-staking.ts        # Sui via RPC (Partial)
      glue-network.ts       # Glue Network via API (Partial)
      mars.ts               # Stub — no per-trade PnL
      jupiter.ts, drift.ts, vertex.ts, mux.ts,
      osmosis.ts, synthetix.ts, perennial.ts  # Stubs
  components/
    EventTable.tsx      # Sortable preview table with color-coded tags & categories
  app/
    page.tsx            # Main UI (platform select → input → preview → export)
    api/events/route.ts # POST endpoint — fetch, validate, classify errors
    layout.tsx          # Root layout (dark mode)
tests/
  unit/
    validation.test.ts  # 95 validation + integration tests
    adversarial.test.ts # 18 adversarial edge-case tests
```

## Known Limitations

### dYdX v4
- Break-even closes (realizedPnl = exactly 0) are tagged as `open_position` because the API doesn't distinguish opens from closes via a separate field.

### GMX (Arbitrum)
- No discrete funding payment events. Borrowing and funding fees are settled atomically when positions change.
- Fee is reported as 0 because GMX fees are already reflected in `basePnlUsd`.

### Aevo
- Requires API key and secret. Credentials are sent server-side and never stored.
- Only perpetual instruments (`*-PERP`) are processed.

### Kwenta
- Close-only mode. No opens or funding payments.
- Users may need their Kwenta smart margin account address, not their EOA.

### General
- All adapters paginate up to platform-specific limits (typically 50-100 pages). Accounts with extremely long histories may be truncated — a prominent warning is shown when this occurs.
- Timestamps are converted to UTC.

## License

MIT
