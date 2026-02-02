"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AwakensEvent, ValidationError, ClassifiedError } from "@/lib/core/types";
import { generateCSV } from "@/lib/core/csv";
import EventTable from "@/components/EventTable";

// ─── Mode mapping (client-side only, no backend changes) ───
const PLATFORM_MODES: Record<string, "strict" | "assisted" | "partial" | "blocked"> = {
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


const PLATFORMS = [
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
const PLATFORM_DOCS: Record<string, { supported: string[]; blocked: string[]; why: string }> = {
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
const FAMILY_LABELS: Record<string, string> = {
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
const ADDRESS_PATTERNS: { match: (addr: string) => boolean; platformIds: string[] }[] = [
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

function detectPlatformsForAddress(address: string): typeof PLATFORMS {
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

// ─── Wizard steps ───
type Step = "address" | "detect" | "credentials" | "loading" | "preview";

const STEP_META = [
  { key: "address", label: "Address", num: "01" },
  { key: "detect", label: "Platform", num: "02" },
  { key: "credentials", label: "Auth", num: "03" },
  { key: "loading", label: "Fetch", num: "04" },
  { key: "preview", label: "Export", num: "05" },
] as const;

const STEP_ORDER: Step[] = ["address", "detect", "credentials", "loading", "preview"];

const ITEMS_PER_PAGE = 25;

// ─── Refusal tooltip data ───
const REFUSAL_TOOLTIPS: Record<string, string> = {
  "Infer trades from token transfers": "Token transfers alone cannot distinguish trades from other movements. Including them would create false accounting events.",
  "Reconstruct balances from state changes": "Balance deltas between blocks may include unrelated operations. Only explicit protocol events provide accurate attribution.",
  "Estimate unrealized P&L": "Unrealized gains/losses depend on market prices and are not protocol-defined events. Including them would introduce audit risk.",
  "Guess missing or ambiguous data": "When data is incomplete, guessing introduces errors that compound across an accounting period.",
  "Net, aggregate, or summarize values": "Aggregated values lose the per-event granularity that auditors and tax authorities require.",
  "Display charts, dashboards, or analytics": "Visual analytics imply interpretation. This tool exports raw, verifiable events only.",
};

export default function Home() {
  // ─── Core state ───
  const [step, setStep] = useState<Step>("address");
  const [platform, setPlatform] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiSecret, setApiSecret] = useState<string>("");
  const [events, setEvents] = useState<AwakensEvent[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [error, setError] = useState<string>("");
  const [classifiedError, setClassifiedError] = useState<ClassifiedError | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");

  // ─── Wizard state ───
  const [detectedPlatforms, setDetectedPlatforms] = useState<typeof PLATFORMS>([]);
  const [skipAuth, setSkipAuth] = useState(false);

  // ─── Preview state ───
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof AwakensEvent>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterYear, setFilterYear] = useState<string>("all");

  // ─── Dark mode state ───
  const [darkMode, setDarkMode] = useState(true);

  // ─── Command palette state ───
  const [platformSearchOpen, setPlatformSearchOpen] = useState(false);
  const [platformQuery, setPlatformQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paletteBodyRef = useRef<HTMLDivElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ─── Clear error state helper ───
  function clearError() {
    setError("");
    setClassifiedError(null);
  }

  // ─── Derive platform info ───
  const currentPlatform = PLATFORMS.find((p) => p.id === platform);
  const platformName = currentPlatform?.name || platform;
  const needsAuth = currentPlatform?.requiresAuth || false;
  const platformMode = PLATFORM_MODES[platform] || "strict";
  const platformDoc = PLATFORM_DOCS[platform];

  // ─── Command palette filtering ───
  const allReadyPlatforms = useMemo(() => PLATFORMS.filter((p) => p.ready), []);

  const filteredForSearch = useMemo(() => {
    const source = allReadyPlatforms;
    if (!platformQuery.trim()) return source;
    const q = platformQuery.toLowerCase();
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.family.toLowerCase().includes(q) ||
        (p.hint && p.hint.toLowerCase().includes(q))
    );
  }, [allReadyPlatforms, platformQuery]);

  const groupedResults = useMemo(() => {
    const ready = filteredForSearch.filter((p) => p.ready);
    const notReady = platformQuery.trim()
      ? PLATFORMS.filter((p) => !p.ready).filter(
          (p) =>
            p.name.toLowerCase().includes(platformQuery.toLowerCase()) ||
            p.family.toLowerCase().includes(platformQuery.toLowerCase())
        )
      : PLATFORMS.filter((p) => !p.ready);

    const familyGroups: Record<string, typeof PLATFORMS> = {};
    ready.forEach((p) => {
      if (!familyGroups[p.family]) familyGroups[p.family] = [];
      familyGroups[p.family].push(p);
    });

    return { familyGroups, notReady };
  }, [filteredForSearch, platformQuery]);

  const flatResults = useMemo(() => {
    const items: typeof PLATFORMS = [];
    Object.values(groupedResults.familyGroups).forEach((group) => items.push(...group));
    items.push(...groupedResults.notReady);
    return items;
  }, [groupedResults]);

  // ─── Filtered + paginated events for preview ───
  // Compute available years from events for dropdown
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    events.forEach((e) => {
      // Date format: MM/DD/YYYY HH:MM:SS
      const year = e.date.split(" ")[0]?.split("/")[2];
      if (year) years.add(year);
    });
    return [...years].sort();
  }, [events]);

  // Track original indices through filter + sort so validation errors map correctly
  const filteredEventsWithIndex = useMemo(() => {
    let result = events.map((e, i) => ({ event: e, originalIndex: i }));

    // Tax year filter
    if (filterYear !== "all") {
      result = result.filter(({ event: e }) => {
        const year = e.date.split(" ")[0]?.split("/")[2];
        return year === filterYear;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        ({ event: e }) =>
          e.txHash.toLowerCase().includes(q) ||
          e.tag.toLowerCase().includes(q) ||
          e.asset.toLowerCase().includes(q) ||
          e.paymentToken.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q)
      );
    }
    // Apply page-level sorting so sort applies across all pages
    return result.sort((a, b) => {
      const aVal = a.event[sortKey];
      const bVal = b.event[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [events, searchQuery, sortKey, sortDir, filterYear]);

  // Flat array for backward compat (CSV export, count display, etc.)
  const filteredEvents = useMemo(() => filteredEventsWithIndex.map(({ event }) => event), [filteredEventsWithIndex]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / ITEMS_PER_PAGE));

  const paginatedEventsWithIndex = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEventsWithIndex.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEventsWithIndex, currentPage]);

  const paginatedEvents = useMemo(() => paginatedEventsWithIndex.map(({ event }) => event), [paginatedEventsWithIndex]);

  // Reset page when search or year filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterYear]);

  // ─── Dark mode initialization ───
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setDarkMode(stored !== "light");
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // ─── Mouse tracking for hover glow effects ───
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const card = target.closest(".platform-card, .btn-primary") as HTMLElement | null;
      if (card) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }
    }
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // ─── Focus address input on mount ───
  useEffect(() => {
    if (step === "address") {
      setTimeout(() => addressInputRef.current?.focus(), 100);
    }
  }, [step]);

  // ─── Command palette effects ───
  useEffect(() => {
    if (platformSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
      document.body.style.overflow = "hidden";
    } else {
      setPlatformQuery("");
      setActiveIndex(0);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [platformSearchOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [platformQuery]);

  useEffect(() => {
    if (!platformSearchOpen || !paletteBodyRef.current) return;
    const activeEl = paletteBodyRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, platformSearchOpen]);

  // Global Ctrl+K to open palette (available on address and detect steps)
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (step === "address" || step === "detect") setPlatformSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && platformSearchOpen) {
        setPlatformSearchOpen(false);
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, [step, platformSearchOpen]);

  // ─── Actions ───

  function proceedToDetect() {
    const addr = account.trim();
    if (!addr) return;
    const detected = detectPlatformsForAddress(addr);
    setDetectedPlatforms(detected);
    setStep("detect");
    clearError();
  }

  function selectPlatform(id: string) {
    setPlatform(id);
    setPlatformSearchOpen(false);
    const plat = PLATFORMS.find((p) => p.id === id);

    // If no account entered yet, show platform on detect step instead of fetching
    if (!account.trim()) {
      setDetectedPlatforms(PLATFORMS.filter(p => p.id === id));
      setStep("detect");
      clearError();
      return;
    }

    if (plat?.requiresAuth) {
      setSkipAuth(false);
      setStep("credentials");
    } else {
      setSkipAuth(true);
      fetchEventsForPlatform(id);
    }
    clearError();
  }

  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatResults[activeIndex];
        if (item && item.ready) selectPlatform(item.id);
      } else if (e.key === "Escape") {
        setPlatformSearchOpen(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flatResults, activeIndex]
  );

  function cancelFetch() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearError();
    setStep("detect");
  }

  async function fetchEventsForPlatform(platformId: string) {
    if (!account.trim()) return;

    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep("loading");
    clearError();
    setTruncated(false);

    try {
      const body: Record<string, string> = {
        platform: platformId,
        account: account.trim(),
      };

      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (apiSecret.trim()) body.apiSecret = apiSecret.trim();

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        const classified: ClassifiedError | null = data.classified || null;
        setClassifiedError(classified);
        setError(data.error || `HTTP ${res.status}`);
        const plat = PLATFORMS.find(p => p.id === platformId);
        // Route based on error type, not just whether platform needs auth
        if (classified?.type === "auth") {
          setStep("credentials");
        } else if (classified?.type === "validation") {
          setStep("address");
        } else if (classified?.type === "network" || classified?.type === "rate-limit") {
          // Stay on current step — retry button will be shown via loading→detect fallback
          setStep("detect");
        } else if (plat?.requiresAuth) {
          setStep("credentials");
        } else {
          setStep("detect");
        }
        return;
      }

      setEvents(data.events);
      setValidationErrors(data.validationErrors || []);
      setEventCount(data.count);
      setTruncated(data.truncated || false);
      setSearchQuery("");
      setCurrentPage(1);
      setStep("preview");
    } catch (err: unknown) {
      // Don't show errors for user-initiated cancellations
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Failed to fetch events");
      setStep("detect");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  async function fetchEvents() {
    await fetchEventsForPlatform(platform);
  }

  // Export uses filtered events (respects year filter) but ignores search query
  const exportEvents = useMemo(() => {
    if (filterYear === "all") return events;
    return events.filter((e) => {
      const year = e.date.split(" ")[0]?.split("/")[2];
      return year === filterYear;
    });
  }, [events, filterYear]);

  function downloadCSV() {
    try {
      const csv = generateCSV(exportEvents);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const yearSuffix = filterYear !== "all" ? `-${filterYear}` : "";
      a.download = `${platform}-awakens${yearSuffix}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "CSV generation failed");
    }
  }

  function downloadJSON() {
    if (validationErrors.length > 0) return;
    const json = JSON.stringify(exportEvents, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const yearSuffix = filterYear !== "all" ? `-${filterYear}` : "";
    a.download = `${platform}-awakens${yearSuffix}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("address");
    setPlatform("");
    setAccount("");
    setApiKey("");
    setApiSecret("");
    setEvents([]);
    setValidationErrors([]);
    setError("");
    setClassifiedError(null);
    setTruncated(false);
    setEventCount(0);
    setDetectedPlatforms([]);
    setSearchQuery("");
    setCurrentPage(1);
    setFilterYear("all");
    setSkipAuth(false);
    setViewMode("list");
    setSortKey("date");
    setSortDir("asc");
  }

  // ─── Helpers ───

  function modeLabel(mode: string) {
    if (mode === "assisted") return { label: "Assisted", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    if (mode === "partial") return { label: "Partial", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" };
    return { label: "Strict", color: "text-[var(--accent)]", bg: "bg-[var(--accent-dim)]", border: "border-[var(--accent-border)]" };
  }

  function formatTag(tag: string): string {
    return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatPnl(pnl: number, paymentToken: string): string {
    if (pnl === 0) return "0";
    const prefix = pnl > 0 ? "+" : "";
    const s = pnl.toFixed(8).replace(/\.?0+$/, "");
    return `${prefix}${s} ${paymentToken}`;
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
      {/* ─── Header ─── */}
      <div className="mb-8 sm:mb-14 animate-fade-in ambient-glow">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Awakens Exporter</span>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="theme-toggle"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            />
          </div>
          <h1 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.03em] text-[var(--text-primary)] mb-1 leading-[1.15]">
            Accounting Event<br className="hidden sm:block" /> Exporter
          </h1>
          <div className="w-12 h-[2px] bg-gradient-to-r from-[var(--accent)] to-transparent rounded-full mb-4" />
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
            Export protocol-defined accounting events into Awakens-compatible CSV.
            Only events explicitly emitted by the protocol are included.
          </p>
        </div>
      </div>

      {/* ─── Step indicator ─── */}
      {step !== "address" && (
        <div className="step-indicator-wrap flex items-center gap-1 mb-8 sm:mb-10 animate-fade-in">
          {STEP_META.map((s, i) => {
            const isActive = step === s.key;
            const isPast = stepIndex > i;
            const isSkipped = s.key === "credentials" && skipAuth && !isActive;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <div className={`w-4 sm:w-8 h-px mx-0.5 sm:mx-1 ${isPast || isActive ? "bg-[var(--accent)]" : isSkipped ? "bg-[var(--border-medium)] opacity-40" : "bg-[var(--border-subtle)]"}`} />}
                <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)]"
                    : isPast
                    ? "text-[var(--accent)]"
                    : isSkipped
                    ? "text-[var(--text-tertiary)] opacity-40 line-through"
                    : "text-[var(--text-tertiary)]"
                }`}>
                  <span className="opacity-50">{s.num}</span>
                  <span className="font-medium hidden sm:inline">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Error display ─── */}
      {error && (
        <div className={`mb-8 p-4 rounded-lg text-sm font-mono whitespace-pre-wrap animate-fade-in ${
          classifiedError?.blockedByDesign
            ? "bg-zinc-500/10 border border-zinc-500/20 text-zinc-400"
            : classifiedError?.type === "rate-limit"
            ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              classifiedError?.blockedByDesign ? "bg-zinc-500/20" : classifiedError?.type === "rate-limit" ? "bg-amber-500/20" : "bg-red-500/20"
            }`}>
              {classifiedError?.blockedByDesign ? (
                <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1 space-y-2">
              {classifiedError && (
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {classifiedError.blockedByDesign ? "Blocked by design" : classifiedError.type.replace("-", " ")}
                </div>
              )}
              <div>{error}</div>
              {classifiedError?.userAction && !classifiedError.blockedByDesign && (
                <div className="pt-2 border-t border-current/10 flex items-center gap-3">
                  <span className="text-[11px] opacity-80">{classifiedError.userAction}</span>
                  {(classifiedError.type === "network" || classifiedError.type === "rate-limit" || classifiedError.type === "internal") && (
                    <button
                      onClick={fetchEvents}
                      className="px-3 py-1 text-[11px] font-semibold rounded-md border border-current/20 hover:bg-current/10 transition-colors duration-200"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
              {classifiedError?.blockedByDesign && (
                <div className="pt-2 border-t border-current/10 text-[11px] opacity-80">
                  This is a protocol limitation, not a bug. No workaround is available.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 1: Address Input
         ═══════════════════════════════════════════════════ */}
      {step === "address" && (
        <div className="animate-fade-in-up">
          {/* Trust anchor */}
          <div className="mb-8 p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Accounting-grade accuracy</h3>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  We export only protocol-defined accounting events. When data is ambiguous or incomplete, we block the export to prevent accounting errors.
                </p>
              </div>
            </div>
          </div>

          {/* Address input */}
          <div className="max-w-lg mb-10">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
              Wallet or account address
            </label>
            <p className="text-[12px] text-[var(--text-tertiary)] mb-4 leading-relaxed">
              Paste your address and we&apos;ll detect compatible platforms automatically.
            </p>
            <div className="flex gap-2">
              <input
                ref={addressInputRef}
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && proceedToDetect()}
                placeholder="0x..., cosmos1..., stake1..., tz1..."
                spellCheck={false}
                autoComplete="off"
                className="flex-1 px-4 py-3.5 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
              />
              <button
                onClick={proceedToDetect}
                disabled={!account.trim()}
                className="btn-primary relative px-6 py-3.5 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span className="relative z-10">Continue</span>
              </button>
            </div>
            <button
              onClick={() => setPlatformSearchOpen(true)}
              className="mt-4 flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              Or browse all platforms
              <span className="hidden sm:inline ml-1 opacity-60">
                <kbd className="palette-kbd text-[9px] px-1">Ctrl+K</kbd>
              </span>
            </button>
          </div>

          {/* Explicit Refusals with tooltips */}
          <div className="mb-10 p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">What This Tool Will Never Do</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {Object.entries(REFUSAL_TOOLTIPS).map(([item, tooltip], i) => (
                <div key={i} className="group/tip relative flex items-center gap-2.5 text-[12px] text-[var(--text-secondary)]">
                  <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />
                  <span className="cursor-help border-b border-dotted border-[var(--border-medium)]">{item}</span>
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tip:block z-20 max-w-xs px-3 py-2 text-[11px] text-[var(--text-primary)] bg-[var(--surface-3)] border border-[var(--border-medium)] rounded-lg shadow-2xl shadow-black/30 pointer-events-none leading-relaxed">
                    {tooltip}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              Skipped for accuracy — inferred events are blocked to avoid audit risk.
            </p>
          </div>

          {/* Eligibility criteria */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Eligibility Criteria</span>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { label: "Protocol emits explicit accounting events", description: "Rewards, penalties, and trades must be emitted as discrete protocol events — not derived from state." },
                { label: "Actor and amount are explicit", description: "The recipient and the value must be unambiguously defined in the event, not inferred from balance changes." },
                { label: "No balance inference required", description: "If determining a reward requires comparing balances across blocks, the chain is ineligible." },
                { label: "Deterministic replay possible", description: "Given the same inputs, the same events must be produced every time. No dependency on external state." },
              ].map((criterion, i) => (
                <div key={i} className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[var(--accent-dim)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[12px] font-semibold text-[var(--text-primary)] mb-0.5 leading-snug">{criterion.label}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">{criterion.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 2: Platform Detection
         ═══════════════════════════════════════════════════ */}
      {step === "detect" && (
        <div className="animate-fade-in-up">
          {/* Detected platforms */}
          {detectedPlatforms.length > 0 ? (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {detectedPlatforms.length} compatible platform{detectedPlatforms.length !== 1 ? "s" : ""} detected
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)] mb-5 leading-relaxed">
                Select the platform where your activity occurred. The address <span className="font-mono text-[var(--text-secondary)]">{account.slice(0, 12)}...{account.slice(-6)}</span> matches these platforms.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
                {detectedPlatforms.map((p) => {
                  const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPlatform(p.id)}
                      className="platform-card p-4 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent-border)] bg-[var(--surface-1)] text-left transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{p.name}</span>
                        <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${mode.bg} ${mode.color} border ${mode.border} uppercase tracking-wider`}>
                          {mode.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">{p.hint}</div>
                      {p.requiresAuth && (
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400/80">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          Requires API key
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mb-8 p-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] text-center">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">No platforms auto-detected for this address format</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Browse all platforms below to find your chain.</p>
            </div>
          )}

          {/* Browse all platforms */}
          <button
            onClick={() => setPlatformSearchOpen(true)}
            className="w-full flex items-center gap-3.5 px-5 py-4 bg-[var(--surface-1)] border border-[var(--border-medium)] rounded-xl text-left transition-all duration-200 hover:border-[var(--accent-border)] hover:bg-[var(--surface-2)] group mb-8"
          >
            <svg className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="flex-1 text-[15px] text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">Browse all {allReadyPlatforms.length} platforms...</span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
              <kbd className="palette-kbd">Ctrl</kbd>
              <kbd className="palette-kbd">K</kbd>
            </span>
          </button>

          <button onClick={() => { setStep("address"); clearError(); }} className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Change address
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 3: Credentials
         ═══════════════════════════════════════════════════ */}
      {step === "credentials" && (
        <div className="max-w-lg space-y-6 animate-fade-in-up">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
              {platformName}
            </label>
            <p className="text-[12px] text-[var(--text-tertiary)] mb-5 leading-relaxed">{currentPlatform?.hint || "Enter your credentials"}</p>

            {/* Mode context banners */}
            {platformMode === "assisted" && (
              <div className="mb-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 text-[10px] font-bold">!</span>
                  </div>
                  <div className="text-[12px] text-amber-300 leading-relaxed">
                    <span className="font-semibold">Assisted Mode</span> — This platform may produce events that require manual review. We highlight these so you can verify them before export.
                  </div>
                </div>
              </div>
            )}
            {platformMode === "partial" && (
              <div className="mb-5 p-4 rounded-lg bg-sky-500/10 border border-sky-500/20">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sky-400 text-[10px] font-bold">i</span>
                  </div>
                  <div className="text-[12px] text-sky-300 leading-relaxed">
                    <span className="font-semibold">Partial Support</span> — Only a subset of accounting events can be safely exported for this chain. Events that require inference are intentionally blocked.
                  </div>
                </div>
              </div>
            )}

            {/* Platform docs */}
            {platformDoc && (
              <div className="mb-5 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="space-y-2 text-[12px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] mr-2">Supported</span>
                    <span className="text-[var(--text-secondary)]">{platformDoc.supported.join(" / ")}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-red-500 mr-2">Blocked</span>
                    <span className="text-[var(--text-tertiary)]">{platformDoc.blocked.join(" / ")}</span>
                  </div>
                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--text-tertiary)] italic">{platformDoc.why}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Account display (read-only) */}
            <div className="mb-4">
              <label className="block text-[11px] font-mono font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">Account</label>
              <div className="px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg font-mono text-sm text-[var(--text-secondary)] truncate">
                {account}
              </div>
            </div>
          </div>

          {/* API key fields */}
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-300 leading-relaxed">
              <div className="font-semibold mb-1 text-amber-200">Credentials are never stored</div>
              Sent directly to {platformName}&apos;s API from our server. We recommend a read-only key.
            </div>
            <div>
              <label className="block text-[11px] font-mono font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key"
                spellCheck={false}
                className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-medium text-[var(--text-tertiary)] mb-1.5 uppercase tracking-wider">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
                placeholder="Your API secret"
                spellCheck={false}
                className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
              />
            </div>
            <button
              onClick={fetchEvents}
              disabled={!account.trim() || !apiKey.trim()}
              className="btn-primary relative w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span className="relative z-10">Fetch accounting events</span>
            </button>
          </div>

          <button onClick={() => { setStep("detect"); clearError(); }} className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to platform selection
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 4: Loading
         ═══════════════════════════════════════════════════ */}
      {step === "loading" && (
        <div className="animate-fade-in py-20 flex flex-col items-center justify-center gap-6">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border border-[var(--border-subtle)]" />
            <div className="absolute inset-1 rounded-full border border-[var(--border-subtle)] opacity-60" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]" style={{ animation: "spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite" }} />
            <div className="absolute inset-[6px] rounded-full border-2 border-transparent border-b-[var(--accent)]" style={{ animation: "spin 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)]" style={{ animation: "breathe 2s ease-in-out infinite" }} />
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">Fetching accounting events</div>
            <div className="text-[12px] font-mono text-[var(--text-tertiary)]">{platformName}</div>
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-[var(--accent)]" style={{ animation: "breathe 1.2s ease-in-out infinite", animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
            <button
              onClick={cancelFetch}
              className="mt-4 px-4 py-2 text-[12px] font-medium border border-[var(--border-subtle)] rounded-md text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          STEP 5: Preview + Export
         ═══════════════════════════════════════════════════ */}
      {step === "preview" && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Stats bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 glow-line">
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <div className="font-mono">
                <span className="text-[var(--accent)] font-bold text-lg">{eventCount}</span>
                <span className="text-[var(--text-tertiary)] text-xs ml-1.5">event{eventCount !== 1 ? "s" : ""}</span>
              </div>
              <div className="w-px h-4 bg-[var(--border-subtle)]" />
              <span className="text-[var(--text-secondary)] font-medium text-[13px]">{platformName}</span>
              {validationErrors.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-mono font-medium">
                  {validationErrors.length} error{validationErrors.length > 1 ? "s" : ""}
                </span>
              )}
              {(() => {
                const ml = modeLabel(platformMode);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${ml.bg} border ${ml.border} ${ml.color} text-[11px] font-mono font-medium`}>
                    {ml.label}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-[11px] font-mono font-medium transition-all duration-200 ${
                    viewMode === "list" ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  List
                </button>
                <div className="w-px bg-[var(--border-subtle)]" />
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1.5 text-[11px] font-mono font-medium transition-all duration-200 ${
                    viewMode === "table" ? "bg-[var(--surface-3)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  Table
                </button>
              </div>
              <button
                onClick={reset}
                className="px-3.5 py-1.5 text-[12px] font-medium border border-[var(--border-subtle)] rounded-md text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all duration-200"
              >
                Start Over
              </button>
              {/* CSV export */}
              <button
                onClick={downloadCSV}
                disabled={validationErrors.length > 0}
                className="group btn-primary relative px-4 py-2 text-[12px] font-semibold bg-[var(--accent)] text-white rounded-md hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span className="relative z-10">Export CSV</span>
              </button>
              {/* JSON export */}
              <button
                onClick={downloadJSON}
                disabled={validationErrors.length > 0}
                className="px-4 py-2 text-[12px] font-semibold border border-[var(--accent-border)] text-[var(--accent)] rounded-md hover:bg-[var(--accent-dim)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                Export JSON
              </button>
            </div>
          </div>

          {/* Truncation warning */}
          {truncated && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-xs font-bold">!</span>
                </div>
                <div>
                  <div className="text-amber-300 text-sm font-semibold">Results may be truncated</div>
                  <div className="text-[12px] text-amber-400/80 mt-1 leading-relaxed">
                    The API pagination limit was reached. Some older events may not be included in this export.
                    The exported data is still accurate for the events shown, but may not represent your complete history.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assisted/Partial mode warnings */}
          {platformMode === "assisted" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-[10px] font-bold">!</span>
                </div>
                <div className="text-[12px] text-amber-300 leading-relaxed">
                  <span className="font-semibold">Assisted Mode</span> — Some events may require manual review before use in accounting. Review each event for accuracy.
                </div>
              </div>
            </div>
          )}
          {platformMode === "partial" && (
            <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-lg animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sky-400 text-[10px] font-bold">i</span>
                </div>
                <div className="text-[12px] text-sky-300 leading-relaxed">
                  <span className="font-semibold">Partial Support</span> — Only protocol-defined events are included. Events requiring inference are blocked by design.
                </div>
              </div>
            </div>
          )}

          {/* Integrity panel */}
          <div className="relative bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-lg px-6 py-5 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-[var(--border-strong)]" />
            <p className="font-mono text-[12px] text-[var(--text-secondary)] tracking-widest uppercase mb-3">Export Integrity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2.5">
              {[
                "Protocol-defined accounting events only",
                "No inferred balances or P&L",
                "Deterministic & replayable exports",
                "Ambiguous activity blocked by design",
              ].map((claim, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-[var(--text-tertiary)] leading-snug">
                  <span className="mt-[5px] block w-1 h-1 rounded-full bg-[var(--text-tertiary)] opacity-60 shrink-0" />
                  {claim}
                </div>
              ))}
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-red-400 text-sm font-semibold">Export blocked — system-level validation failure</div>
                  <div className="text-[11px] text-red-400/80 mt-0.5">
                    These errors originate from the platform adapter data and cannot be resolved by changing your input.
                    Export is blocked to protect accounting accuracy.
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-red-400 max-h-40 overflow-y-auto">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <div key={i}>Row {e.row}: [{e.field}] {e.message} <span className="text-red-400/50">(value: {e.value})</span></div>
                ))}
                {validationErrors.length > 20 && (
                  <div className="text-[var(--text-tertiary)] pt-1">... and {validationErrors.length - 20} more</div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-red-500/20 text-[11px] text-red-400/70">
                Classification: SYSTEM-BLOCKED — This is a data integrity issue in the adapter output. No user action can resolve these errors.
              </div>
            </div>
          )}

          {/* Search + pagination controls */}
          {events.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Tax year filter */}
              {availableYears.length > 1 && (
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-md font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] transition-all duration-200"
                >
                  <option value="all">All years ({events.length})</option>
                  {availableYears.map((year) => {
                    const count = events.filter((e) => e.date.split(" ")[0]?.split("/")[2] === year).length;
                    return <option key={year} value={year}>{year} ({count})</option>;
                  })}
                </select>
              )}
              {/* Search */}
              <div className="relative flex-1 w-full sm:max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search txHash, type, asset..."
                  spellCheck={false}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-md font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Row count + pagination */}
              <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-tertiary)]">
                <span>
                  {searchQuery
                    ? `${filteredEvents.length} of ${events.length} events`
                    : `${events.length} event${events.length !== 1 ? "s" : ""}`
                  }
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Prev
                    </button>
                    <span className="text-[var(--text-secondary)]">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Search empty state */}
          {searchQuery && filteredEvents.length === 0 && events.length > 0 && (
            <div className="text-center py-12 px-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-1">No events match &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-[12px] text-[var(--text-tertiary)]">Try a different search term or clear your search.</p>
            </div>
          )}

          {/* Events display */}
          {events.length > 0 ? (
            <>
              {/* List view */}
              {viewMode === "list" && (
                <div className="space-y-1.5 stagger">
                  {paginatedEventsWithIndex.map(({ event, originalIndex }, i) => {
                    const tagColors: Record<string, string> = {
                      open_position: "text-blue-400",
                      close_position: "text-teal-400",
                      funding_payment: "text-amber-400",
                      staking_reward: "text-violet-400",
                      slashing: "text-rose-400",
                    };
                    const tagDots: Record<string, string> = {
                      open_position: "bg-blue-400",
                      close_position: "bg-teal-400",
                      funding_payment: "bg-amber-400",
                      staking_reward: "bg-violet-400",
                      slashing: "bg-rose-400",
                    };
                    const pnlColor = event.pnl > 0 ? "text-emerald-400" : event.pnl < 0 ? "text-red-400" : "text-[var(--text-tertiary)]";
                    const hasErrors = validationErrors.some((e) => e.row === originalIndex);

                    return (
                      <details
                        key={`${event.txHash}-${originalIndex}`}
                        className={`event-item animate-fade-in group rounded-lg border transition-all duration-200 ${
                          hasErrors
                            ? darkMode ? "border-red-500/20 bg-red-500/[0.08]" : "border-red-300/40 bg-red-50"
                            : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] bg-[var(--surface-1)]"
                        }`}
                      >
                        <summary className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 cursor-pointer list-none select-none">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tagDots[event.tag] || "bg-zinc-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-semibold ${tagColors[event.tag] || "text-[var(--text-secondary)]"}`}>{formatTag(event.tag)}</span>
                              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{event.asset}</span>
                            </div>
                            <div className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">
                              {event.date}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[13px] font-mono font-medium text-[var(--text-primary)]">
                              {event.amount.toFixed(8).replace(/\.?0+$/, "")}
                              <span className="text-[var(--text-tertiary)] ml-1 text-[11px]">{event.asset}</span>
                            </div>
                            {event.pnl !== 0 && (
                              <div className={`text-[11px] font-mono ${pnlColor}`}>
                                {formatPnl(event.pnl, event.paymentToken)}
                              </div>
                            )}
                          </div>
                          <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-open:rotate-90 transition-transform duration-200 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </summary>
                        <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] ml-6">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-mono">
                            <div>
                              <span className="text-[var(--text-tertiary)]">Fee </span>
                              <span className="text-[var(--text-secondary)]">{event.fee.toFixed(8).replace(/\.?0+$/, "")}</span>
                            </div>
                            <div>
                              <span className="text-[var(--text-tertiary)]">Token </span>
                              <span className="text-[var(--text-secondary)]">{event.paymentToken || "—"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[var(--text-tertiary)]">Tx </span>
                              <span className="text-[var(--text-tertiary)] break-all">{event.txHash}</span>
                            </div>
                            {event.notes && (
                              <div className="col-span-2">
                                <span className="text-[var(--text-tertiary)]">Notes </span>
                                <span className="text-[var(--text-secondary)]">{event.notes}</span>
                              </div>
                            )}
                            {hasErrors && (
                              <div className="col-span-2 mt-1 text-red-400">
                                {validationErrors.filter((e) => e.row === originalIndex).map((err, idx) => (
                                  <div key={idx}>[{err.field}] {err.message}</div>
                                ))}
                              </div>
                            )}
                            {platformMode === "assisted" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-amber-400">Review this event for accuracy before export.</div>
                            )}
                            {platformMode === "partial" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-sky-400">Partial — only protocol-defined events included.</div>
                            )}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}

              {/* Table view */}
              {viewMode === "table" && (
                <EventTable
                  events={paginatedEvents}
                  validationErrors={validationErrors}
                  platformMode={platformMode}
                  pageOffset={(currentPage - 1) * ITEMS_PER_PAGE}
                  pageSortKey={sortKey}
                  pageSortDir={sortDir}
                  onPageSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
                />
              )}

              {/* Bottom pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-[11px] font-mono text-[var(--text-tertiary)]">
                  <span>
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length)} of {filteredEvents.length}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-2.5 py-1 rounded border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-[var(--text-secondary)]">{currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-2.5 py-1 rounded border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 px-4">
              <div className="max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">No events found</h3>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed mb-4">
                  No protocol-defined accounting events were returned for this account.
                  This may mean the account has no qualifying activity, or the address format may be incorrect.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={reset}
                    className="px-4 py-2 text-[12px] font-medium border border-[var(--border-subtle)] rounded-md text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all duration-200"
                  >
                    Try different account
                  </button>
                  <button
                    onClick={() => { setStep("address"); clearError(); }}
                    className="px-4 py-2 text-[12px] font-medium border border-[var(--accent-border)] rounded-md text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-all duration-200"
                  >
                    Edit address
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          Command Palette (available on address + detect steps)
         ═══════════════════════════════════════════════════ */}
      {platformSearchOpen && (
        <>
          <div className="palette-backdrop" onClick={() => setPlatformSearchOpen(false)} />
          <div className="command-palette" role="dialog" aria-modal="true" aria-label="Search platforms">
            <div className="command-palette-header">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={platformQuery}
                  onChange={(e) => setPlatformQuery(e.target.value)}
                  onKeyDown={handlePaletteKeyDown}
                  placeholder="Search platforms..."
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  onClick={() => setPlatformSearchOpen(false)}
                  className="flex-shrink-0 palette-kbd text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  esc
                </button>
              </div>
            </div>

            <div className="command-palette-body" ref={paletteBodyRef}>
              {Object.entries(groupedResults.familyGroups).map(([family, platforms]) => (
                <div key={family}>
                  <div className="command-palette-group">
                    {FAMILY_LABELS[family] || family}
                  </div>
                  {platforms.map((p) => {
                    const idx = flatResults.indexOf(p);
                    const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
                    return (
                      <button
                        key={p.id}
                        data-active={idx === activeIndex}
                        onClick={() => selectPlatform(p.id)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className="command-palette-item w-full text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="palette-item-name">{p.name}</div>
                          <div className="palette-item-hint truncate">{p.hint}</div>
                        </div>
                        <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${mode.bg} ${mode.color} border ${mode.border} uppercase tracking-wider flex-shrink-0`}>
                          {mode.label}
                        </span>
                        {p.requiresAuth && (
                          <svg className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {groupedResults.notReady.length > 0 && (
                <div>
                  <div className="command-palette-group">Coming Soon</div>
                  {groupedResults.notReady.map((p) => (
                    <div
                      key={p.id}
                      className="command-palette-item opacity-30 cursor-not-allowed"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="palette-item-name">{p.name}</div>
                        <div className="palette-item-hint truncate">{p.hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {flatResults.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="text-sm text-[var(--text-tertiary)] mb-1">No platforms found</div>
                  <div className="text-xs text-[var(--text-tertiary)] opacity-60">Try a different search term</div>
                </div>
              )}
            </div>

            <div className="command-palette-footer">
              <span className="flex items-center gap-1.5"><kbd className="palette-kbd">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1.5"><kbd className="palette-kbd">↵</kbd> select</span>
              <span className="flex items-center gap-1.5"><kbd className="palette-kbd">esc</kbd> close</span>
              <span className="ml-auto">{filteredForSearch.filter(p => p.ready).length} available</span>
            </div>
          </div>
        </>
      )}

      {/* ─── Footer ─── */}
      <footer className="mt-20 pt-6 pb-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)] tracking-wide">
          <span>Awakens Exporter &middot; Correctness-first accounting</span>
          <span className="uppercase">Protocol events only</span>
        </div>
      </footer>
    </main>
  );
}
