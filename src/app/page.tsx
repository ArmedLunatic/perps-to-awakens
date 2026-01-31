"use client";

import { useState } from "react";
import { AwakensEvent, ValidationError } from "@/lib/core/types";
import { generateCSV } from "@/lib/core/csv";
import EventTable from "@/components/EventTable";

// Mode mapping for platforms (client-side only, no backend changes)
const PLATFORM_MODES: Record<string, "strict" | "assisted" | "blocked"> = {
  // Assisted mode platforms
  "levana-osmosis": "assisted",
  "levana-injective": "assisted",
  "levana-neutron": "assisted",
  "levana-juno": "assisted",
  // Strict mode (default for all others)
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

type Step = "select" | "input" | "loading" | "preview";

export default function Home() {
  const [step, setStep] = useState<Step>("select");
  const [platform, setPlatform] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiSecret, setApiSecret] = useState<string>("");
  const [events, setEvents] = useState<AwakensEvent[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [error, setError] = useState<string>("");
  const [eventCount, setEventCount] = useState(0);

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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 mb-2">Perps to Awakens</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Convert perps, staking & chain events to Awakens-compatible CSV
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2.5 mb-8 text-xs font-medium text-zinc-500">
        <span className={`transition-colors duration-150 ${step === "select" ? "text-zinc-100" : ""}`}>1. Platform</span>
        <span className="text-zinc-600">→</span>
        <span className={`transition-colors duration-150 ${step === "input" ? "text-zinc-100" : ""}`}>2. Account</span>
        <span className="text-zinc-600">→</span>
        <span className={`transition-colors duration-150 ${step === "loading" ? "text-zinc-100" : ""}`}>3. Fetch</span>
        <span className="text-zinc-600">→</span>
        <span className={`transition-colors duration-150 ${step === "preview" ? "text-zinc-100" : ""}`}>4. Export</span>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-800/40 rounded-lg text-red-300 text-sm font-mono whitespace-pre-wrap transition-opacity duration-200">
          {error}
        </div>
      )}

      {/* Step 1: Platform selection */}
      {step === "select" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => {
            const mode = PLATFORM_MODES[p.id] || "strict";
            return (
              <button
                key={p.id}
                onClick={() => p.ready && selectPlatform(p.id)}
                disabled={!p.ready}
                className={`group p-4 rounded-lg border text-left transition-all duration-150 ${
                  p.ready
                    ? "border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/40 cursor-pointer"
                    : "border-zinc-800/30 opacity-40 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-zinc-100">{p.name}</div>
                  {p.ready && mode === "assisted" && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/40">
                      Assisted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {p.requiresAuth && (
                    <span className="text-[10px] font-medium text-amber-500/80">API key</span>
                  )}
                  <div className="text-xs text-zinc-500">
                    {p.ready ? (p.hint || "Ready") : p.hint || "Coming soon"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 2: Account input */}
      {step === "input" && (
        <div className="max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              {platformName}
            </label>
            <p className="text-xs text-zinc-500 mb-3">{currentPlatform?.hint || "wallet address"}</p>
            {platformMode === "assisted" && (
              <div className="mb-3 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-amber-300/90 leading-relaxed">
                    <span className="font-medium">Assisted Mode:</span> Some events may require manual review. Check the confidence indicators in the preview.
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
                className="flex-1 px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 placeholder:text-zinc-600 transition-all duration-150"
              />
              {!needsAuth && (
                <button
                  onClick={fetchEvents}
                  disabled={!account.trim()}
                  className="px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-medium text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                >
                  Fetch
                </button>
              )}
            </div>
          </div>

          {/* API key fields for authenticated adapters */}
          {needsAuth && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg text-xs text-amber-300/90 leading-relaxed">
                Your API credentials are sent directly to {platformName}&apos;s API from our server
                and are never stored or logged. Create a read-only API key for safety.
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your API key"
                  spellCheck={false}
                  className="w-full px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 placeholder:text-zinc-600 transition-all duration-150"
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
                  className="w-full px-4 py-2.5 bg-zinc-900/50 border border-zinc-700/50 rounded-lg font-mono text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 placeholder:text-zinc-600 transition-all duration-150"
                />
              </div>
              <button
                onClick={fetchEvents}
                disabled={!account.trim() || !apiKey.trim() || !apiSecret.trim()}
                className="w-full px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-medium text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              >
                Fetch
              </button>
            </div>
          )}

          <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150">
            ← Back
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
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-zinc-800/50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-400">
                <span className="text-zinc-100 font-semibold">{eventCount}</span> accounting event{eventCount !== 1 ? "s" : ""} from{" "}
                <span className="text-zinc-100 font-medium">{platformName}</span>
              </span>
              {validationErrors.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-950/30 border border-red-800/40 text-red-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {validationErrors.length} error{validationErrors.length > 1 ? "s" : ""}
                </span>
              )}
              {platformMode === "assisted" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/30 border border-amber-800/40 text-amber-400 text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Assisted Mode
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm border border-zinc-700/50 rounded-lg hover:bg-zinc-900/50 hover:border-zinc-600 transition-all duration-150"
              >
                Start Over
              </button>
              <button
                onClick={downloadCSV}
                disabled={validationErrors.length > 0}
                className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              >
                Export Awakens CSV
              </button>
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-950/20 border border-red-800/40 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="text-red-300 text-sm font-medium">
                  Export blocked — fix these errors:
                </div>
              </div>
              <div className="space-y-1.5 text-xs font-mono text-red-400/90 max-h-40 overflow-y-auto">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <div key={i} className="pl-1">
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

          {/* Event table */}
          {events.length > 0 ? (
            <EventTable events={events} validationErrors={validationErrors} platformMode={platformMode} />
          ) : (
            <div className="text-zinc-500 text-center py-12 text-sm">
              No accounting events found for this account.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
