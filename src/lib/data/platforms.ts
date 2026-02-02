// ─── Platform data — single source of truth ───
// Imported by page.tsx and /platforms page

// ─── Mode mapping (client-side only, no backend changes) ───
export const PLATFORM_MODES: Record<string, "strict" | "assisted" | "partial" | "blocked"> = {
  "levana-osmosis": "assisted",
  "levana-injective": "assisted",
  "levana-neutron": "assisted",
  "levana-juno": "assisted",
  "cardano-staking": "partial",
  "eth-validator": "partial",
  "solana-staking": "partial",
  "kadena-mining": "partial",
  "aptos-staking": "partial",
  "sui-staking": "partial",
  "glue-network": "partial",
};

export type Platform = {
  id: string;
  name: string;
  ready: boolean;
  placeholder: string;
  hint: string;
  requiresAuth: boolean;
  family: string;
};

export const PLATFORMS: Platform[] = [
  // --- EVM/REST Perps ---
  { id: "hyperliquid", name: "Hyperliquid", ready: true, placeholder: "0x...", hint: "Ethereum address (0x...)", requiresAuth: false, family: "evm-perps" },
  { id: "dydx", name: "dYdX v4", ready: true, placeholder: "dydx1...", hint: "dYdX bech32 address", requiresAuth: false, family: "evm-perps" },
  { id: "gmx", name: "GMX", ready: true, placeholder: "0x...", hint: "Ethereum address (Arbitrum)", requiresAuth: false, family: "evm-perps" },
  { id: "aevo", name: "Aevo", ready: true, placeholder: "0x...", hint: "Ethereum address + API key", requiresAuth: true, family: "evm-perps" },
  { id: "kwenta", name: "Kwenta", ready: true, placeholder: "0x...", hint: "Optimism address (close-only mode)", requiresAuth: false, family: "evm-perps" },

  // --- Substrate Staking ---
  { id: "polkadot-staking", name: "Polkadot", ready: true, placeholder: "1...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "kusama-staking", name: "Kusama", ready: true, placeholder: "C...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "westend-staking", name: "Westend", ready: true, placeholder: "5...", hint: "SS58 address — testnet staking", requiresAuth: false, family: "substrate-staking" },
  { id: "rococo-staking", name: "Rococo", ready: true, placeholder: "5...", hint: "SS58 address — testnet staking", requiresAuth: false, family: "substrate-staking" },
  { id: "statemint-staking", name: "Statemint", ready: true, placeholder: "1...", hint: "SS58 address — Asset Hub (Polkadot)", requiresAuth: false, family: "substrate-staking" },
  { id: "statemine-staking", name: "Statemine", ready: true, placeholder: "C...", hint: "SS58 address — Asset Hub (Kusama)", requiresAuth: false, family: "substrate-staking" },
  { id: "bittensor-staking", name: "Bittensor", ready: true, placeholder: "5...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "hydradx-staking", name: "HydraDX", ready: true, placeholder: "7...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "astar-staking", name: "Astar", ready: true, placeholder: "5...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "shiden-staking", name: "Shiden", ready: true, placeholder: "5...", hint: "SS58 address — staking rewards & slashing", requiresAuth: false, family: "substrate-staking" },
  { id: "moonbeam-staking", name: "Moonbeam", ready: true, placeholder: "0x...", hint: "H160 address — DPoS staking only", requiresAuth: false, family: "substrate-staking" },
  { id: "moonriver-staking", name: "Moonriver", ready: true, placeholder: "0x...", hint: "H160 address — DPoS staking only", requiresAuth: false, family: "substrate-staking" },

  // --- Cosmos SDK Staking ---
  { id: "cosmos-hub-staking", name: "Cosmos Hub", ready: true, placeholder: "cosmos1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },
  { id: "osmosis-staking", name: "Osmosis Staking", ready: true, placeholder: "osmo1...", hint: "Bech32 address — staking only", requiresAuth: false, family: "cosmos-staking" },
  { id: "neutron-staking", name: "Neutron Staking", ready: true, placeholder: "neutron1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },
  { id: "juno-staking", name: "Juno Staking", ready: true, placeholder: "juno1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },
  { id: "stride-staking", name: "Stride Staking", ready: true, placeholder: "stride1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },
  { id: "akash-staking", name: "Akash Staking", ready: true, placeholder: "akash1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },
  { id: "secret-staking", name: "Secret Network", ready: true, placeholder: "secret1...", hint: "Bech32 address — staking rewards & slashing", requiresAuth: false, family: "cosmos-staking" },

  // --- CosmWasm Perps — Levana ---
  { id: "levana-osmosis", name: "Levana (Osmosis)", ready: true, placeholder: "osmo1...", hint: "Bech32 address — perps open/close", requiresAuth: false, family: "cosmwasm-perps" },
  { id: "levana-injective", name: "Levana (Injective)", ready: true, placeholder: "inj1...", hint: "Bech32 address — perps open/close", requiresAuth: false, family: "cosmwasm-perps" },
  { id: "levana-neutron", name: "Levana (Neutron)", ready: true, placeholder: "neutron1...", hint: "Bech32 address — perps open/close", requiresAuth: false, family: "cosmwasm-perps" },
  { id: "levana-juno", name: "Levana (Juno)", ready: true, placeholder: "juno1...", hint: "Bech32 address — perps open/close", requiresAuth: false, family: "cosmwasm-perps" },

  // --- Tezos Staking ---
  { id: "tezos-staking", name: "Tezos", ready: true, placeholder: "tz1...", hint: "Tezos address — baking & delegation rewards, slashing", requiresAuth: false, family: "tezos-staking" },

  // --- Cardano Staking (Partial) ---
  { id: "cardano-staking", name: "Cardano", ready: true, placeholder: "stake1...", hint: "Stake address — reward withdrawals only (requires Blockfrost API key)", requiresAuth: true, family: "cardano-staking" },

  // --- NEAR Protocol Staking ---
  { id: "near-staking", name: "NEAR Protocol", ready: true, placeholder: "alice.near", hint: "NEAR account — staking rewards & slashing", requiresAuth: false, family: "near-staking" },

  // --- Ethereum Validator (Partial) ---
  { id: "eth-validator", name: "Ethereum Validator", ready: true, placeholder: "12345", hint: "Validator index or pubkey — consensus-layer rewards only", requiresAuth: false, family: "eth-validator" },

  // --- Algorand Staking (Strict) ---
  { id: "algorand-staking", name: "Algorand", ready: true, placeholder: "ABC...XYZ", hint: "Algorand address — participation rewards only", requiresAuth: false, family: "algorand-staking" },

  // --- Avalanche P-Chain Staking (Strict) ---
  { id: "avalanche-staking", name: "Avalanche P-Chain", ready: true, placeholder: "P-avax1...", hint: "P-chain address — validator/delegator rewards only", requiresAuth: false, family: "avalanche-staking" },

  // --- Solana Staking (Partial) ---
  { id: "solana-staking", name: "Solana Staking", ready: true, placeholder: "Stake...", hint: "Stake account — epoch reward credits only (no balance inference)", requiresAuth: false, family: "solana-staking" },

  // --- Kadena Mining (Partial) ---
  { id: "kadena-mining", name: "Kadena", ready: true, placeholder: "k:abc123...", hint: "Kadena account — explicit coinbase rewards only", requiresAuth: false, family: "kadena-mining" },

  // --- Aptos Staking (Partial) ---
  { id: "aptos-staking", name: "Aptos", ready: true, placeholder: "0x...", hint: "Aptos address — explicit staking reward events only", requiresAuth: false, family: "aptos-staking" },

  // --- Sui Staking (Partial) ---
  { id: "sui-staking", name: "Sui", ready: true, placeholder: "0x...", hint: "Sui address — staking reward withdrawals only", requiresAuth: false, family: "sui-staking" },

  // --- Glue Network (Partial) ---
  { id: "glue-network", name: "Glue Network", ready: true, placeholder: "0x...", hint: "Explicit protocol rewards and settlement events only", requiresAuth: false, family: "glue-network" },

  // --- CosmWasm Perps — Mars (Stub) ---
  { id: "mars-osmosis", name: "Mars (Osmosis)", ready: false, placeholder: "", hint: "No confirmed per-trade realized PnL", requiresAuth: false, family: "cosmwasm-perps" },
  { id: "mars-neutron", name: "Mars (Neutron)", ready: false, placeholder: "", hint: "No confirmed per-trade realized PnL", requiresAuth: false, family: "cosmwasm-perps" },

  // --- Stubbed EVM/REST Perps ---
  { id: "jupiter", name: "Jupiter Perps", ready: false, placeholder: "", hint: "No trade history API", requiresAuth: false, family: "evm-perps" },
  { id: "drift", name: "Drift", ready: false, placeholder: "", hint: "No per-trade P&L in API", requiresAuth: false, family: "evm-perps" },
  { id: "vertex", name: "Vertex", ready: false, placeholder: "", hint: "No per-trade P&L", requiresAuth: false, family: "evm-perps" },
  { id: "mux", name: "MUX Protocol", ready: false, placeholder: "", hint: "Aggregator — fragmented data", requiresAuth: false, family: "evm-perps" },
  { id: "osmosis", name: "Osmosis Perps", ready: false, placeholder: "", hint: "No indexer available", requiresAuth: false, family: "cosmwasm-perps" },
  { id: "synthetix", name: "Synthetix v3", ready: false, placeholder: "", hint: "Account NFT resolution", requiresAuth: false, family: "evm-perps" },
  { id: "perennial", name: "Perennial", ready: false, placeholder: "", hint: "No public subgraph endpoint", requiresAuth: false, family: "evm-perps" },
];

// ─── Platform-level documentation ───
export const PLATFORM_DOCS: Record<string, { supported: string[]; blocked: string[]; why: string }> = {
  "tezos-staking": {
    supported: ["Baking rewards", "Delegation rewards", "Slashing (double-baking/endorsing)"],
    blocked: ["DeFi activity", "Token transfers", "Balance inference", "Liquidity baking subsidies"],
    why: "Tezos protocol emits explicit reward and penalty events via TzKT indexer.",
  },
  "cardano-staking": {
    supported: ["Reward withdrawal transactions (on-chain events only)"],
    blocked: ["Epoch reward accrual (off-ledger computation)", "Balance snapshots", "Stake pool delegation changes", "ISPO/token rewards"],
    why: "Cardano accrues rewards per-epoch without on-chain events. Only explicit withdrawal transactions are deterministic.",
  },
  "near-staking": {
    supported: ["Staking rewards (explicit receipts)", "Slashing penalties"],
    blocked: ["DeFi activity", "Token transfers", "Balance inference", "Lockup contract rewards"],
    why: "NEAR emits explicit action receipts for staking operations via Nearblocks indexer.",
  },
  "eth-validator": {
    supported: ["Consensus-layer rewards (attestation, proposer, sync committee)"],
    blocked: ["Execution-layer rewards (tx fees, priority fees)", "MEV rewards", "Withdrawal events", "Restaking rewards (EigenLayer)"],
    why: "Only CL rewards are protocol-defined with deterministic attribution. EL rewards require inference.",
  },
  "algorand-staking": {
    supported: ["Explicit participation rewards (protocol-emitted per-account events)"],
    blocked: ["DeFi activity", "Token transfers", "Balance inference", "ASA rewards", "Governance rewards (off-chain)"],
    why: "Algorand emits explicit reward events via the Indexer. Governance rewards are off-chain and excluded.",
  },
  "avalanche-staking": {
    supported: ["Validator staking rewards (explicit reward UTXOs)", "Delegator staking rewards"],
    blocked: ["Subnet DeFi", "C-chain/X-chain transfers", "Trade inference", "Liquid staking (sAVAX)"],
    why: "Avalanche P-chain emits explicit reward UTXOs when validation/delegation periods end.",
  },
  "solana-staking": {
    supported: ["Explicit epoch reward credits (via getInflationReward RPC)"],
    blocked: ["Balance-delta epoch inference", "Swaps / DEX activity", "NFT activity", "Liquid staking (mSOL, jitoSOL)", "MEV / Jito tips"],
    why: "Solana RPC returns explicit per-account reward amounts per epoch. We do NOT infer from balance changes.",
  },
  "kadena-mining": {
    supported: ["Explicit coinbase rewards where miner address is protocol-defined"],
    blocked: ["Per-account rewards not explicit in block events", "Gas fees as income", "DeFi activity", "Balance inference"],
    why: "Kadena emits coinbase events with explicit miner address and amount. Only these are exported.",
  },
  "aptos-staking": {
    supported: ["Explicit DistributeRewardsEvent from staking module"],
    blocked: ["DeFi activity", "Token transfers", "Balance inference", "Liquid staking rewards"],
    why: "Aptos emits reward distribution events on the staking module with explicit amounts.",
  },
  "sui-staking": {
    supported: ["Staking reward withdrawals (explicit protocol events)"],
    blocked: ["DeFi activity", "Token transfers", "Balance inference", "Liquid staking rewards (afSUI, haSUI)"],
    why: "Sui emits explicit events when staking rewards are withdrawn. Estimated rewards are intentionally excluded.",
  },
  "glue-network": {
    supported: ["Explicit protocol reward distributions", "Explicit incentive claims", "Explicit settlement events (realized per-account values only)"],
    blocked: ["Trade reconstruction", "Swap inference", "Balance-based activity", "Cross-chain message value estimation", "LP position tracking"],
    why: "Only protocol-emitted per-account events are exported. All inference-based activity is blocked.",
  },
};

// ─── Family labels for grouping ───
export const FAMILY_LABELS: Record<string, string> = {
  "evm-perps": "EVM Perps",
  "cosmwasm-perps": "CosmWasm Perps",
  "substrate-staking": "Substrate Staking",
  "cosmos-staking": "Cosmos Staking",
  "tezos-staking": "Tezos",
  "cardano-staking": "Cardano",
  "near-staking": "NEAR",
  "eth-validator": "Ethereum",
  "algorand-staking": "Algorand",
  "avalanche-staking": "Avalanche",
  "solana-staking": "Solana",
  "kadena-mining": "Kadena",
  "aptos-staking": "Aptos",
  "sui-staking": "Sui",
  "glue-network": "Glue Network",
};

// ─── Address pattern detection ───
export const ADDRESS_PATTERNS: { match: (addr: string) => boolean; platformIds: string[] }[] = [
  { match: (a) => a.startsWith("dydx1"), platformIds: ["dydx"] },
  { match: (a) => a.startsWith("cosmos1"), platformIds: ["cosmos-hub-staking"] },
  { match: (a) => a.startsWith("osmo1"), platformIds: ["osmosis-staking", "levana-osmosis"] },
  { match: (a) => a.startsWith("neutron1"), platformIds: ["neutron-staking", "levana-neutron"] },
  { match: (a) => a.startsWith("juno1"), platformIds: ["juno-staking", "levana-juno"] },
  { match: (a) => a.startsWith("stride1"), platformIds: ["stride-staking"] },
  { match: (a) => a.startsWith("akash1"), platformIds: ["akash-staking"] },
  { match: (a) => a.startsWith("secret1"), platformIds: ["secret-staking"] },
  { match: (a) => a.startsWith("inj1"), platformIds: ["levana-injective"] },
  { match: (a) => /^tz[123]/.test(a), platformIds: ["tezos-staking"] },
  { match: (a) => a.startsWith("stake1") && a.length >= 50, platformIds: ["cardano-staking"] },
  { match: (a) => a.endsWith(".near") || a.endsWith(".testnet"), platformIds: ["near-staking"] },
  { match: (a) => /^\d+$/.test(a) && a.length <= 10 && parseInt(a) >= 0 && parseInt(a) <= 2000000, platformIds: ["eth-validator"] },
  { match: (a) => a.startsWith("P-avax1"), platformIds: ["avalanche-staking"] },
  { match: (a) => a.startsWith("Stake"), platformIds: ["solana-staking"] },
  { match: (a) => a.startsWith("k:"), platformIds: ["kadena-mining"] },
  { match: (a) => /^1[a-zA-Z0-9]/.test(a) && a.length > 20, platformIds: ["polkadot-staking", "statemint-staking"] },
  { match: (a) => /^C[a-zA-Z0-9]/.test(a) && a.length > 20, platformIds: ["kusama-staking", "statemine-staking"] },
  { match: (a) => /^5[a-zA-Z0-9]/.test(a) && a.length > 20, platformIds: ["westend-staking", "rococo-staking", "bittensor-staking", "astar-staking", "shiden-staking"] },
  { match: (a) => /^7[a-zA-Z0-9]/.test(a) && a.length > 20, platformIds: ["hydradx-staking"] },
  { match: (a) => a.length >= 58 && /^[A-Z2-7]+$/.test(a), platformIds: ["algorand-staking"] },
  // EVM addresses: 0x + 40 hex chars = 42 total length
  { match: (a) => /^0x[0-9a-fA-F]{40}$/.test(a), platformIds: ["hyperliquid", "gmx", "aevo", "kwenta", "moonbeam-staking", "moonriver-staking", "glue-network"] },
  // Aptos/Sui addresses: 0x + 64 hex chars = 66 total length
  { match: (a) => /^0x[0-9a-fA-F]{64}$/.test(a), platformIds: ["aptos-staking", "sui-staking"] },
];

export function detectPlatformsForAddress(address: string): Platform[] {
  const addr = address.trim();
  if (!addr) return [];

  const matchedIds = new Set<string>();
  for (const pattern of ADDRESS_PATTERNS) {
    if (pattern.match(addr)) {
      pattern.platformIds.forEach((id) => matchedIds.add(id));
    }
  }

  if (matchedIds.size === 0) return [];
  return PLATFORMS.filter((p) => p.ready && matchedIds.has(p.id));
}

export function modeLabel(mode: string) {
  if (mode === "assisted") return { label: "Assisted", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  if (mode === "partial") return { label: "Partial", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" };
  return { label: "Strict", color: "text-[var(--accent)]", bg: "bg-[var(--accent-dim)]", border: "border-[var(--accent-border)]" };
}

// ─── Refusal tooltip data ───
export const REFUSAL_TOOLTIPS: Record<string, string> = {
  "Infer trades from token transfers": "Token transfers alone cannot distinguish trades from other movements. Including them would create false accounting events.",
  "Reconstruct balances from state changes": "Balance deltas between blocks may include unrelated operations. Only explicit protocol events provide accurate attribution.",
  "Estimate unrealized P&L": "Unrealized gains/losses depend on market prices and are not protocol-defined events. Including them would introduce audit risk.",
  "Guess missing or ambiguous data": "When data is incomplete, guessing introduces errors that compound across an accounting period.",
  "Net, aggregate, or summarize values": "Aggregated values lose the per-event granularity that auditors and tax authorities require.",
  "Display charts, dashboards, or analytics": "Visual analytics imply interpretation. This tool exports raw, verifiable events only.",
};
