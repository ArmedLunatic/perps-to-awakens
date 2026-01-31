"use client";

import { useState, useRef, useCallback } from "react";
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
  const gridRef = useRef<HTMLDivElement>(null);

  // Track mouse position on platform cards for radial glow
  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  }, []);

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

  const selectedUsecase = USECASES.find((u) => u.id === usecase);
  const filteredPlatforms = usecase
    ? PLATFORMS.filter((p) => selectedUsecase?.families.includes(p.family))
    : PLATFORMS;

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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-10 sm:mb-14 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-md bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Awakens Exporter</span>
        </div>
        <h1 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.03em] text-[var(--text-primary)] mb-3 leading-[1.15]">
          Accounting Event<br className="hidden sm:block" /> Exporter
        </h1>
        <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
          Export protocol-defined accounting events into Awakens-compatible CSV.
          Only events explicitly emitted by the protocol are included.
        </p>
      </div>

      {/* Step indicator */}
      {step !== "select" && (
        <div className="flex items-center gap-1 mb-10 animate-fade-in">
          {[
            { key: "select", label: "Platform", num: "01" },
            { key: "input", label: "Account", num: "02" },
            { key: "loading", label: "Fetch", num: "03" },
            { key: "preview", label: "Export", num: "04" },
          ].map((s, i) => {
            const isActive = step === s.key;
            const isPast = ["select", "input", "loading", "preview"].indexOf(step) > i;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <div className={`w-8 h-px mx-1 ${isPast || isActive ? "bg-[var(--accent)]" : "bg-[var(--border-subtle)]"}`} />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                  isActive
                    ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)]"
                    : isPast
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-tertiary)]"
                }`}>
                  <span className="opacity-50">{s.num}</span>
                  <span className="font-medium">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-8 p-4 bg-red-500/5 border border-red-500/15 rounded-lg text-red-300 text-sm font-mono whitespace-pre-wrap animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">{error}</div>
          </div>
        </div>
      )}

      {/* ═══════════ Step 1: Usecase + Platform selection ═══════════ */}
      {step === "select" && (
        <div className="animate-fade-in-up">
          {/* Usecase selector */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Use Case</span>
              <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger">
              {USECASES.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => setUsecase(usecase === uc.id ? null : uc.id)}
                  data-active={usecase === uc.id}
                  className={`usecase-card animate-fade-in p-5 rounded-lg border text-left transition-all duration-200 ${
                    usecase === uc.id
                      ? "border-[var(--accent-border)] bg-[var(--accent-dim)]"
                      : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1.5 transition-colors ${usecase === uc.id ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                    {uc.label}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] leading-relaxed">{uc.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Trust anchor */}
          <div className="mb-10 p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
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
                  Blocked data is a safety feature, not a limitation.
                </p>
              </div>
            </div>
          </div>

          {/* Platform grid */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">
                  {usecase ? `${selectedUsecase?.label}` : "All Platforms"}
                </span>
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              </div>
              {usecase && (
                <button
                  onClick={() => setUsecase(null)}
                  className="text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200"
                >
                  [show all]
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mb-4 leading-relaxed">
              {usecase === "perps" && "Platforms that emit explicit trade and funding events."}
              {usecase === "staking" && "Chains that emit explicit staking reward and penalty events."}
              {usecase === "advanced" && "Chains with limited but verifiable protocol events. Review blocked items carefully."}
              {!usecase && "Choose the platform where your activity occurred."}
            </p>
          </div>
          <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 stagger">
            {filteredPlatforms.map((p) => {
              const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
              return (
                <button
                  key={p.id}
                  onClick={() => p.ready && selectPlatform(p.id)}
                  onMouseMove={handleCardMouseMove}
                  disabled={!p.ready}
                  className={`platform-card animate-fade-in p-4 rounded-lg border text-left ${
                    p.ready
                      ? "border-[var(--border-subtle)] hover:border-[var(--border-strong)] cursor-pointer"
                      : "border-[var(--border-subtle)] opacity-30 cursor-not-allowed"
                  }`}
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-[var(--text-primary)] text-[13px] tracking-[-0.01em]">{p.name}</div>
                      {p.ready && (
                        <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${mode.bg} ${mode.color} border ${mode.border} uppercase tracking-wider`}>
                          {mode.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.requiresAuth && (
                        <span className="text-[9px] font-mono font-medium text-amber-400/70 uppercase tracking-wider">API Key</span>
                      )}
                      <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed truncate">
                        {p.ready ? (p.hint || "Ready") : p.hint || "Coming soon"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chain Eligibility Framework */}
          <div className="mt-14 mb-10">
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
            <p className="mt-3 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              If any criterion fails, the activity or chain is blocked. This is how we prevent accounting errors at scale.
            </p>
          </div>

          {/* Explicit Refusals */}
          <div className="mb-10 p-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Explicit Refusals</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {[
                "Infer trades from token transfers",
                "Reconstruct balances from state changes",
                "Estimate unrealized P&L",
                "Guess missing or ambiguous data",
                "Net, aggregate, or summarize values",
                "Display charts, dashboards, or analytics",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12px] text-[var(--text-secondary)]">
                  <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              These constraints are deliberate. Each one eliminates a category of accounting risk.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ Step 2: Account input ═══════════ */}
      {step === "input" && (
        <div className="max-w-lg space-y-6 animate-fade-in-up">
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
              {platformName}
            </label>
            <p className="text-[12px] text-[var(--text-tertiary)] mb-5 leading-relaxed">{currentPlatform?.hint || "Enter your wallet address"}</p>

            {/* Mode context banner */}
            {platformMode === "assisted" && (
              <div className="mb-5 p-4 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-400 text-[10px] font-bold">!</span>
                  </div>
                  <div className="text-[12px] text-amber-300/90 leading-relaxed">
                    <span className="font-semibold">Assisted Mode</span> — This platform may produce events that require manual review. We highlight these so you can verify them before export.
                  </div>
                </div>
              </div>
            )}
            {platformMode === "partial" && (
              <div className="mb-5 p-4 rounded-lg bg-sky-500/5 border border-sky-500/15">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-sky-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-sky-400 text-[10px] font-bold">i</span>
                  </div>
                  <div className="text-[12px] text-sky-300/90 leading-relaxed">
                    <span className="font-semibold">Partial Support</span> — Only a subset of accounting events can be safely exported for this chain. Events that require inference are intentionally blocked.
                  </div>
                </div>
              </div>
            )}

            {/* Platform-specific docs */}
            {platformDoc && (
              <div className="mb-5 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="space-y-2 text-[12px]">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent)] mr-2">Supported</span>
                    <span className="text-[var(--text-secondary)]">{platformDoc.supported.join(" / ")}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-red-400/70 mr-2">Blocked</span>
                    <span className="text-[var(--text-tertiary)]">{platformDoc.blocked.join(" / ")}</span>
                  </div>
                  <div className="pt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--text-tertiary)] italic">{platformDoc.why}</span>
                  </div>
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
                className="flex-1 px-4 py-3 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
              />
              {!needsAuth && (
                <button
                  onClick={fetchEvents}
                  disabled={!account.trim()}
                  className="btn-primary relative px-6 py-3 bg-[var(--accent)] text-[var(--surface-0)] rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <span className="relative z-10">Fetch</span>
                </button>
              )}
            </div>
          </div>

          {/* API key fields */}
          {needsAuth && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[12px] text-amber-300/80 leading-relaxed">
                <div className="font-semibold mb-1 text-amber-300/90">Credentials are never stored</div>
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
                className="btn-primary relative w-full px-6 py-3 bg-[var(--accent)] text-[var(--surface-0)] rounded-lg font-semibold text-sm hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span className="relative z-10">Fetch accounting events</span>
              </button>
            </div>
          )}

          <button onClick={reset} className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to platforms
          </button>
        </div>
      )}

      {/* ═══════════ Step 3: Loading ═══════════ */}
      {step === "loading" && (
        <div className="animate-fade-in py-16 flex flex-col items-center justify-center gap-5">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--border-subtle)]" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent)]" style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">Fetching accounting events</div>
            <div className="text-[12px] font-mono text-[var(--text-tertiary)]">{platformName}</div>
          </div>
        </div>
      )}

      {/* ═══════════ Step 4: Preview + Export ═══════════ */}
      {step === "preview" && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Stats bar */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-5 glow-line">
            <div className="flex items-center gap-3 text-sm">
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
            <div className="flex items-center gap-2">
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
              <button
                onClick={downloadCSV}
                disabled={validationErrors.length > 0}
                className="btn-primary relative px-4 py-1.5 text-[12px] font-semibold bg-[var(--accent)] text-[var(--surface-0)] rounded-md hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span className="relative z-10">Export CSV</span>
              </button>
            </div>
          </div>

          {/* Export Integrity Proof */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] font-mono text-[var(--text-tertiary)]">
            {["Protocol-defined events only", "No inferred balances or P&L", "Deterministic & replayable", "Ambiguous data blocked"].map((label, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {label}
              </span>
            ))}
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-5 bg-red-500/5 border border-red-500/15 rounded-lg">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <div className="text-red-300 text-sm font-semibold">Export blocked</div>
                  <div className="text-[11px] text-red-400/70 mt-0.5">Validation errors must be resolved to protect accounting accuracy.</div>
                </div>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-red-400/80 max-h-40 overflow-y-auto">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <div key={i}>Row {e.row}: [{e.field}] {e.message}</div>
                ))}
                {validationErrors.length > 20 && (
                  <div className="text-[var(--text-tertiary)] pt-1">... and {validationErrors.length - 20} more</div>
                )}
              </div>
            </div>
          )}

          {/* Events display */}
          {events.length > 0 ? (
            <>
              {/* List view */}
              {viewMode === "list" && (
                <div className="space-y-1.5 stagger">
                  {events.map((event, i) => {
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
                    const hasErrors = validationErrors.some((e) => e.row === i);

                    return (
                      <details
                        key={`${event.txHash}-${i}`}
                        className={`event-item animate-fade-in group rounded-lg border transition-all duration-200 ${
                          hasErrors
                            ? "border-red-500/20 bg-red-500/5"
                            : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] bg-[var(--surface-1)]"
                        }`}
                      >
                        <summary className="flex items-center gap-4 px-4 py-3.5 cursor-pointer list-none select-none">
                          {/* Dot indicator */}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tagDots[event.tag] || "bg-zinc-500"}`} />

                          {/* Event info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-semibold ${tagColors[event.tag] || "text-[var(--text-secondary)]"}`}>{formatTag(event.tag)}</span>
                              <span className="text-[11px] font-mono text-[var(--text-tertiary)]">{event.asset}</span>
                            </div>
                            <div className="text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">
                              {event.date}
                            </div>
                          </div>

                          {/* Outcome */}
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

                          {/* Chevron */}
                          <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-open:rotate-90 transition-transform duration-200 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </summary>

                        <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] ml-6">
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
                              <div className="col-span-2 mt-1 text-red-400/80">
                                {validationErrors.filter((e) => e.row === i).map((err, idx) => (
                                  <div key={idx}>[{err.field}] {err.message}</div>
                                ))}
                              </div>
                            )}
                            {platformMode === "assisted" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-amber-400/60">Review this event for accuracy before export.</div>
                            )}
                            {platformMode === "partial" && !hasErrors && (
                              <div className="col-span-2 mt-1 text-sky-400/60">Partial — only protocol-defined events included.</div>
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
                <EventTable events={events} validationErrors={validationErrors} platformMode={platformMode} />
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
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                  No protocol-defined accounting events for this account. Check the address format or account activity.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
