# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A correctness-first accounting exporter that converts perpetuals trading history, staking rewards, and protocol events from 48 platform adapters into Awakens-compatible CSV. The core principle: **blocked > guessed** — the system will never infer P&L, fabricate events, or produce data requiring manual correction.

## Commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint via Next.js
npm run typecheck    # tsc --noEmit
npm test             # Run all tests (validation + adversarial)

# Run a single test file
npx tsx tests/unit/validation.test.ts
npx tsx tests/unit/adversarial.test.ts
```

## Architecture

Next.js app (App Router) with Tailwind CSS v4. No database. No external state. Path alias `@/*` maps to `./src/*`.

### Data Flow

`page.tsx` (UI) → `POST /api/events` → adapter registry → platform API → normalize to `AwakensEvent[]` → validate → preview in `EventTable` → export CSV client-side

### Key Layers

- **`src/lib/core/types.ts`** — `AwakensEvent`, `PerpsAdapter` interface, `ClassifiedError`, `ValidationError`. All adapters return `AwakensEvent[]`.
- **`src/lib/core/validation.ts`** — Pre-export validation (date format, decimal precision, duplicate txHash, tag rules).
- **`src/lib/core/csv.ts`** — CSV generation with strict header: `Date,Asset,Amount,Fee,P&L,Payment Token,Notes,Transaction Hash,Tag`
- **`src/lib/adapters/registry.ts`** — Central registry. `getAdapter(id)` looks up by string ID. All 48 adapters registered here.
- **`src/lib/adapters/utils.ts`** — Shared utilities: `formatDateUTC`, `truncateDecimals` (never round), `fetchWithContext`, `paginateAll`.
- **`src/app/api/events/route.ts`** — Single POST endpoint. Fetches events via adapter, validates, classifies errors with recovery guidance.
- **`src/app/page.tsx`** — Main UI. Contains `PLATFORMS` array (platform metadata, `ready` flag) and `PLATFORM_DOCS`/`PLATFORM_MODES` maps.
- **`src/components/EventTable.tsx`** — Sortable preview table with color-coded tags.

### Adapter Pattern

Each adapter in `src/lib/adapters/` implements `PerpsAdapter`:
- `id` — unique string identifier
- `mode` — `"strict"` (explicit data) or `"assisted"` (may need review)
- `family` — grouping key (e.g. `"substrate-staking"`, `"cosmos-staking"`)
- `supports`/`blocks` — which event tags the adapter can/cannot emit
- `getEvents(account, options?)` — fetch, paginate, normalize, return `AwakensEvent[]`

Stub adapters (Jupiter, Drift, Vertex, etc.) throw "not implemented" errors by design.

### Adapter Families

- **Perps**: `hyperliquid`, `dydx`, `gmx`, `aevo`, `kwenta`, `levana` (4 chains), stubs (7)
- **Substrate staking**: 12 chains via Subscan (`substrate-staking.ts`)
- **Cosmos staking**: 7 chains via LCD (`cosmos-staking.ts`)
- **Single-chain staking**: `tezos`, `cardano`, `near`, `eth-validators`, `algorand`, `avalanche`, `solana`, `kadena`, `aptos`, `sui`, `glue-network`

## Correctness Rules (Non-Negotiable)

- Never infer P&L from balances or position deltas
- Never fabricate funding events or auto-tag without platform data
- Truncate decimals to 8 places (never round) — use `truncateDecimals()` from `utils.ts`
- All dates must be `MM/DD/YYYY HH:MM:SS` (UTC)
- No duplicate `txHash` values in output
- Stub adapters must throw, not return empty arrays
- Every error must be classified (`ClassifiedError`) with recovery guidance — zero dead-end errors

## Adding a New Adapter

1. Create `src/lib/adapters/{platform}.ts` implementing `PerpsAdapter`
2. Register in `src/lib/adapters/registry.ts`
3. Add to `PLATFORMS` array in `src/app/page.tsx` with `ready: true`
4. If partial/assisted, add to `PLATFORM_MODES` in `src/app/page.tsx`
5. If the platform has specific supported/blocked tags, add to `PLATFORM_DOCS`

## UI Constraints (from CURSOR_HANDOFF.md)

UI/UX changes only — do not modify backend logic, adapters, validation, or CSV export. Design direction: bright, minimal, futuristic, audit-safe. Linear flow: usecase → platform → address → results → export.

## Workflow Orchestration

### Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### Verification Before Done

- Never mark a task complete without proving it works
- Diff your behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

- **Plan First**: Write plan to `tasks/todo.md` with checkable items
- **Verify Plan**: Check in before starting implementation
- **Track Progress**: Mark items complete as you go
- **Explain Changes**: High-level summary at each step
- **Document Results**: Add review section to `tasks/todo.md`
- **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
