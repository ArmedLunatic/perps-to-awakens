"use client";

import { useState } from "react";
import { AwakensEvent, ValidationError } from "@/lib/core/types";
import { generateCSV } from "@/lib/core/csv";
import EventTable from "@/components/EventTable";

// Mode mapping for platforms (client-side only, no backend changes)
const PLATFORM_MODES: Record<string, "strict" | "assisted" | "partial" | "blocked"> = {
  // Assisted mode platforms
  "levana-osmosis": "assisted",
  "levana-injective": "assisted",
  "levana-neutron": "assisted",
  "levana-juno": "assisted",
  // Partial mode platforms (limited but safe)
  "cardano-staking": "partial",
  "eth-validator": "partial",
  // Strict mode (default for all others)
};

// Usecase definitions
type Usecase = "perps" | "staking" | "advanced";

const USECASES: { id: Usecase; label: string; description: string; families: string[] }[] = [
  {
    id: "perps",
    label: "Perpetuals Trading",
    description: "Export realized P&L and funding from perps platforms",
    families: ["evm-perps", "cosmwasm-perps"],
  },
  {
    id: "staking",
    label: "Staking & Protocol Rewards",
    description: "Export protocol-defined rewards and penalties",
    families: ["substrate-staking", "cosmos-staking", "tezos-staking", "near-staking"],
  },
  {
    id: "advanced",
    label: "Advanced / Partial Support",
    description: "Niche chains with explicit but limited accounting events",
    families: ["cardano-staking", "eth-validator"],
  },
];

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

// Platform-level documentation for new chains
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
};

type Step = "select" | "input" | "loading" | "preview";

export default function Home() {
  const [step, setStep] = useState<Step>("select");
  const [usecase, setUsecase] = useState<Usecase | null>(null);
  const [platform, setPlatform] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiSecret, setApiSecret] = useState<string>("");
  const [events, setEvents] = useState<AwakensEvent[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [error, setError] = useState<string>("");
  const [eventCount, setEventCount] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "table">("list");

  function selectPlatform(id: string) {
    setPlatform(id);
    setStep("input");
    setError("");
  }

  async function fetchEvents() {
    if (!account.trim()) return;
    setStep("loading");
    setError("");

    try {
      const body: Record<string, string> = {
        platform,
        account: account.trim(),
      };

      // Include API credentials if provided
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (apiSecret.trim()) body.apiSecret = apiSecret.trim();

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setEvents(data.events);
      setValidationErrors(data.validationErrors || []);
      setEventCount(data.count);
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch events");
      setStep("input");
    }
  }

  function downloadCSV() {
    try {
      const csv = generateCSV(events);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${platform}-awakens-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "CSV generation failed");
    }
  }

  function reset() {
    setStep("select");
    setPlatform("");
    setAccount("");
    setApiKey("");
    setApiSecret("");
    setEvents([]);
    setValidationErrors([]);
    setError("");
    setEventCount(0);
  }

  const currentPlatform = PLATFORMS.find((p) => p.id === platform);
  const platformName = currentPlatform?.name || platform;
  const needsAuth = currentPlatform?.requiresAuth || false;
  const platformMode = PLATFORM_MODES[platform] || "strict";
  const platformDoc = PLATFORM_DOCS[platform];

  // Filter platforms by selected usecase
  const selectedUsecase = USECASES.find((u) => u.id === usecase);
  const filteredPlatforms = usecase
    ? PLATFORMS.filter((p) => selectedUsecase?.families.includes(p.family))
    : PLATFORMS;

  // Mode label helper
  function modeLabel(mode: string) {
    if (mode === "assisted") return { label: "Assisted", color: "text-amber-400", bg: "bg-amber-950/40", border: "border-amber-800/40" };
    if (mode === "partial") return { label: "Partial", color: "text-sky-400", bg: "bg-sky-950/40", border: "border-sky-800/40" };
    return { label: "Strict", color: "text-emerald-400", bg: "bg-emerald-950/40", border: "border-emerald-800/40" };
  }

  // Format tag for display
  function formatTag(tag: string): string {
    return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Format P&L for list view
  function formatPnl(pnl: number, paymentToken: string): string {
    if (pnl === 0) return "0";
    const prefix = pnl > 0 ? "+" : "";
    const s = pnl.toFixed(8).replace(/\.?0+$/, "");
    return `${prefix}${s} ${paymentToken}`;
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50 mb-3 leading-tight">
          Accounting Event Exporter
        </h1>
        <p className="text-base text-zinc-400 leading-relaxed max-w-2xl">
          Export protocol-defined accounting events into Awakens-compatible CSV.
          Only events explicitly emitted by the protocol are included.
        </p>
      </div>

      {/* Step indicator */}
      {step !== "select" && (
        <div className="flex items-center gap-2.5 mb-8 text-xs font-medium text-zinc-500">
          <span className="text-zinc-500">1. Platform</span>
          <span className="text-zinc-600">→</span>
          <span className={`transition-colors duration-200 ${step === "input" ? "text-zinc-100" : "text-zinc-500"}`}>2. Account</span>
          <span className="text-zinc-600">→</span>
          <span className={`transition-colors duration-200 ${step === "loading" ? "text-zinc-100" : "text-zinc-500"}`}>3. Fetch</span>
          <span className="text-zinc-600">→</span>
          <span className={`transition-colors duration-200 ${step === "preview" ? "text-zinc-100" : "text-zinc-500"}`}>4. Export</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-800/40 rounded-lg text-red-300 text-sm font-mono whitespace-pre-wrap transition-opacity duration-200">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">{error}</div>
          </div>
        </div>
      )}

      {/* Step 1: Usecase + Platform selection */}
      {step === "select" && (
        <div>
          {/* Usecase selector */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-zinc-300 mb-1">What are you accounting for?</h2>
            <p className="text-xs text-zinc-500 mb-4">Select your use case to see relevant platforms.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {USECASES.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => setUsecase(usecase === uc.id ? null : uc.id)}
                  className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                    usecase === uc.id
                      ? "border-zinc-500 bg-zinc-900/60"
                      : "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/30"
                  }`}
                >
                  <div className="font-medium text-zinc-100 text-sm mb-1">{uc.label}</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">{uc.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Trust anchor */}
          <div className="mb-8 p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-zinc-200 mb-1.5">Accounting-grade accuracy</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  We export only protocol-defined accounting events. When data is ambiguous or incomplete, we block the export to prevent accounting errors.
                  Blocked data is a safety feature, not a limitation.
                </p>
              </div>
            </div>
          </div>

          {/* Platform grid */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-medium text-zinc-300">
                {usecase ? `${selectedUsecase?.label} platforms` : "All platforms"}
              </h2>
              {usecase && (
                <button
                  onClick={() => setUsecase(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
                >
                  Show all
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {usecase === "perps" && "Platforms that emit explicit trade and funding events."}
              {usecase === "staking" && "Chains that emit explicit staking reward and penalty events."}
              {usecase === "advanced" && "Chains with limited but verifiable protocol events. Review blocked items carefully."}
              {!usecase && "Choose the platform where your activity occurred."}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlatforms.map((p) => {
              const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
              return (
                <button
                  key={p.id}
                  onClick={() => p.ready && selectPlatform(p.id)}
                  disabled={!p.ready}
                  className={`group p-4 rounded-lg border text-left transition-all duration-200 ${
                    p.ready
                      ? "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50 cursor-pointer"
                      : "border-zinc-800/30 opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-medium text-zinc-100 text-sm">{p.name}</div>
                    {p.ready && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${mode.bg} ${mode.color} border ${mode.border}`}>
                        {mode.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.requiresAuth && (
                      <span className="text-[10px] font-medium text-amber-500/80">API key</span>
                    )}
                    <div className="text-xs text-zinc-500 leading-relaxed">
                      {p.ready ? (p.hint || "Ready") : p.hint || "Coming soon"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chain Eligibility Framework */}
          <div className="mt-12 mb-8">
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Why a chain is supported</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Protocol emits explicit accounting events", description: "Rewards, penalties, and trades must be emitted as discrete protocol events — not derived from state." },
                { label: "Actor and amount are explicit", description: "The recipient and the value must be unambiguously defined in the event, not inferred from balance changes." },
                { label: "No balance inference required", description: "If determining a reward requires comparing balances across blocks, the chain is ineligible." },
                { label: "Deterministic replay possible", description: "Given the same inputs, the same events must be produced every time. No dependency on external state." },
              ].map((criterion, i) => (
                <div key={i} className="p-3.5 bg-zinc-900/30 border border-zinc-800/40 rounded-lg">
                  <div className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <div>
                      <div className="text-xs font-medium text-zinc-200 mb-0.5">{criterion.label}</div>
                      <div className="text-xs text-zinc-500 leading-relaxed">{criterion.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
              If any criterion fails, the activity or chain is blocked. This is how we prevent accounting errors at scale.
            </p>
          </div>

          {/* Explicit Refusals */}
          <div className="mb-8 p-5 bg-zinc-900/30 border border-zinc-800/40 rounded-lg">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">What we intentionally refuse to do</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {[
                "Infer trades from token transfers",
                "Reconstruct balances from state changes",
                "Estimate unrealized P&L",
                "Guess missing or ambiguous data",
                "Net, aggregate, or summarize values",
                "Display charts, dashboards, or analytics",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-600">—</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500 leading-relaxed">
              These constraints are deliberate. Each one eliminates a category of accounting risk.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Account input */}
      {step === "input" && (
        <div className="max-w-lg space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {platformName} account address
            </label>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">{currentPlatform?.hint || "Enter your wallet address"}</p>

            {/* Mode context banner */}
            {platformMode === "assisted" && (
              <div className="mb-4 p-3.5 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-amber-300/90 leading-relaxed">
                    <span className="font-medium">Assisted Mode:</span> This platform may produce events that require manual review. We highlight these so you can verify them before export.
                  </div>
                </div>
              </div>
            )}
            {platformMode === "partial" && (
              <div className="mb-4 p-3.5 bg-sky-950/20 border border-sky-800/30 rounded-lg">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-sky-300/90 leading-relaxed">
                    <span className="font-medium">Partial Support:</span> Only a subset of accounting events can be safely exported for this chain. Events that require inference are intentionally blocked.
                  </div>
                </div>
              </div>
            )}

            {/* Platform-specific docs */}
            {platformDoc && (
              <div className="mb-4 p-3.5 bg-zinc-900/40 border border-zinc-800/40 rounded-lg text-xs">
                <div className="mb-2">
                  <span className="font-medium text-zinc-300">Supported: </span>
                  <span className="text-zinc-400">{platformDoc.supported.join(", ")}</span>
                </div>
                <div className="mb-2">
                  <span className="font-medium text-zinc-300">Blocked: </span>
                  <span className="text-zinc-500">{platformDoc.blocked.join(", ")}</span>
                </div>
                <div>
                  <span className="font-medium text-zinc-300">Why: </span>
                  <span className="text-zinc-500">{platformDoc.why}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !needsAuth && fetchEvents()}
                placeholder={currentPlatform?.placeholder || "0x..."}
                spellCheck={false}
                className="flex-1 px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent placeholder:text-zinc-600 transition-all duration-200"
              />
              {!needsAuth && (
                <button
                  onClick={fetchEvents}
                  disabled={!account.trim()}
                  className="px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-medium text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Fetch
                </button>
              )}
            </div>
          </div>

          {/* API key fields for authenticated adapters */}
          {needsAuth && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-950/20 border border-amber-800/30 rounded-lg text-xs text-amber-300/90 leading-relaxed">
                <div className="font-medium mb-1">Your credentials are secure</div>
                Your API credentials are sent directly to {platformName}&apos;s API from our server and are never stored or logged. We recommend creating a read-only API key for safety.
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your API key"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent placeholder:text-zinc-600 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">API Secret</label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
                  placeholder="Your API secret"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:border-transparent placeholder:text-zinc-600 transition-all duration-200"
                />
              </div>
              <button
                onClick={fetchEvents}
                disabled={!account.trim() || !apiKey.trim()}
                className="w-full px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-medium text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Fetch accounting events
              </button>
            </div>
          )}

          <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-200">
            ← Back to platform selection
          </button>
        </div>
      )}

      {/* Step 3: Loading */}
      {step === "loading" && (
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <span className="text-sm">Fetching accounting events from {platformName}...</span>
        </div>
      )}

      {/* Step 4: Preview + Export */}
      {step === "preview" && (
        <div className="space-y-6">
          {/* Stats bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 border-b border-zinc-800/50">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-zinc-100 font-semibold">{eventCount}</span>{" "}
                <span className="text-zinc-400">accounting event{eventCount !== 1 ? "s" : ""} from </span>
                <span className="text-zinc-100 font-medium">{platformName}</span>
              </div>
              {validationErrors.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/30 border border-red-800/40 text-red-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.length} error{validationErrors.length > 1 ? "s" : ""}
                </span>
              )}
              {(() => {
                const ml = modeLabel(platformMode);
                return (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${ml.bg} border ${ml.border} ${ml.color} text-xs font-medium`}>
                    {ml.label} Mode
                  </span>
                );
              })()}
            </div>
            <div className="flex gap-2">
              {/* View mode toggle */}
              <div className="flex border border-zinc-700/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
                    viewMode === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
                    viewMode === "table" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  Table
                </button>
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm border border-zinc-700/50 rounded-lg hover:bg-zinc-900/50 hover:border-zinc-600 transition-all duration-200"
              >
                Start Over
              </button>
              <button
                onClick={downloadCSV}
                disabled={validationErrors.length > 0}
                className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                Export Awakens CSV
              </button>
            </div>
          </div>

          {/* Export Integrity Proof */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Protocol-defined events only
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              No inferred balances or P&L
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Deterministic & replayable
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Ambiguous data blocked
            </span>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-5 bg-red-950/20 border border-red-800/40 rounded-lg">
              <div className="flex items-center gap-2.5 mb-3">
                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="text-red-300 text-sm font-medium">
                    Export blocked
                  </div>
                  <div className="text-xs text-red-400/80 mt-0.5">
                    Some events have validation errors that must be resolved before export. This protects your accounting accuracy.
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 text-xs font-mono text-red-400/90 max-h-40 overflow-y-auto pl-1">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <div key={i}>
                    Row {e.row}: [{e.field}] {e.message}
                  </div>
                ))}
                {validationErrors.length > 20 && (
                  <div className="text-zinc-500 pt-1">
                    ... and {validationErrors.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Events display */}
          {events.length > 0 ? (
            <>
              {/* List view (default) */}
              {viewMode === "list" && (
                <div className="space-y-2">
                  {events.map((event, i) => {
                    const tagColors: Record<string, string> = {
                      open_position: "text-blue-400",
                      close_position: "text-emerald-400",
                      funding_payment: "text-amber-400",
                      staking_reward: "text-violet-400",
                      slashing: "text-rose-400",
                    };
                    const tagIcons: Record<string, string> = {
                      open_position: "↗",
                      close_position: "↘",
                      funding_payment: "↔",
                      staking_reward: "↑",
                      slashing: "↓",
                    };
                    const pnlColor = event.pnl > 0 ? "text-emerald-400" : event.pnl < 0 ? "text-red-400" : "text-zinc-500";
                    const hasErrors = validationErrors.some((e) => e.row === i);

                    return (
                      <details
                        key={`${event.txHash}-${i}`}
                        className={`group rounded-lg border transition-all duration-200 ${
                          hasErrors
                            ? "border-red-800/40 bg-red-950/10"
                            : "border-zinc-800/40 bg-zinc-900/20 hover:bg-zinc-900/40"
                        }`}
                      >
                        <summary className="flex items-center gap-4 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          {/* Icon */}
                          <span className={`text-sm ${tagColors[event.tag] || "text-zinc-400"}`}>
                            {tagIcons[event.tag] || "?"}
                          </span>

                          {/* Event meaning */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-100">{formatTag(event.tag)}</span>
                              <span className="text-xs text-zinc-500">{event.asset}</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5 truncate">
                              {event.date} (UTC)
                            </div>
                          </div>

                          {/* Outcome */}
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-mono text-zinc-200">
                              {event.amount.toFixed(8).replace(/\.?0+$/, "")} {event.asset}
                            </div>
                            {event.pnl !== 0 && (
                              <div className={`text-xs font-mono ${pnlColor}`}>
                                {formatPnl(event.pnl, event.paymentToken)}
                              </div>
                            )}
                          </div>

                          {/* Expand indicator */}
                          <svg className="w-4 h-4 text-zinc-600 group-open:rotate-90 transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </summary>

                        {/* Expanded details */}
                        <div className="px-4 pb-3 pt-1 border-t border-zinc-800/30">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                            <div>
                              <span className="text-zinc-500">Fee: </span>
                              <span className="text-zinc-400 font-mono">{event.fee.toFixed(8).replace(/\.?0+$/, "")}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500">Payment Token: </span>
                              <span className="text-zinc-400">{event.paymentToken || "—"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-zinc-500">Tx: </span>
                              <span className="text-zinc-500 font-mono break-all">{event.txHash}</span>
                            </div>
                            {event.notes && (
                              <div className="col-span-2">
                                <span className="text-zinc-500">Notes: </span>
                                <span className="text-zinc-400">{event.notes}</span>
                              </div>
                            )}
                            {hasErrors && (
                              <div className="col-span-2 mt-1">
                                <div className="text-red-400 font-medium mb-1">Validation errors:</div>
                                {validationErrors.filter((e) => e.row === i).map((err, idx) => (
                                  <div key={idx} className="text-red-400/80 font-mono">
                                    [{err.field}] {err.message}
                                  </div>
                                ))}
                              </div>
                            )}
                            {platformMode === "assisted" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-amber-400/80">
                                Assisted Mode — review this event for accuracy before export.
                              </div>
                            )}
                            {platformMode === "partial" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-sky-400/80">
                                Partial Support — only protocol-defined events are included.
                              </div>
                            )}
                          </div>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}

              {/* Table view (secondary) */}
              {viewMode === "table" && (
                <EventTable events={events} validationErrors={validationErrors} platformMode={platformMode} />
              )}
            </>
          ) : (
            <div className="text-center py-16 px-4">
              <div className="max-w-md mx-auto">
                <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <h3 className="text-sm font-medium text-zinc-300 mb-1.5">No accounting events found</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  No protocol-defined accounting events were found for this account.
                  This may mean the account has no activity, or the address format is incorrect.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
