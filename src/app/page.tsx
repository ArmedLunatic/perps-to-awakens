"use client";

import { useState } from "react";
import { AwakensEvent, ValidationError } from "@/lib/core/types";
import { generateCSV } from "@/lib/core/csv";
import EventTable from "@/components/EventTable";

const PLATFORMS = [
  // Fully implemented — wallet address only
  { id: "hyperliquid", name: "Hyperliquid", ready: true, placeholder: "0x...", hint: "Ethereum address (0x...)", requiresAuth: false },
  { id: "dydx", name: "dYdX v4", ready: true, placeholder: "dydx1...", hint: "dYdX bech32 address", requiresAuth: false },
  { id: "gmx", name: "GMX", ready: true, placeholder: "0x...", hint: "Ethereum address (Arbitrum)", requiresAuth: false },
  // Fully implemented — requires API key
  { id: "aevo", name: "Aevo", ready: true, placeholder: "0x...", hint: "Ethereum address + API key", requiresAuth: true },
  // Close-only mode
  { id: "kwenta", name: "Kwenta", ready: true, placeholder: "0x...", hint: "Optimism address (close-only mode)", requiresAuth: false },
  // Stubbed — missing API data
  { id: "jupiter", name: "Jupiter Perps", ready: false, placeholder: "", hint: "No trade history API", requiresAuth: false },
  { id: "drift", name: "Drift", ready: false, placeholder: "", hint: "No per-trade P&L in API", requiresAuth: false },
  { id: "vertex", name: "Vertex", ready: false, placeholder: "", hint: "No per-trade P&L", requiresAuth: false },
  { id: "mux", name: "MUX Protocol", ready: false, placeholder: "", hint: "Aggregator — fragmented data", requiresAuth: false },
  { id: "osmosis", name: "Osmosis Perps", ready: false, placeholder: "", hint: "No indexer available", requiresAuth: false },
  { id: "synthetix", name: "Synthetix v3", ready: false, placeholder: "", hint: "Account NFT resolution", requiresAuth: false },
  { id: "perennial", name: "Perennial", ready: false, placeholder: "", hint: "No public subgraph endpoint", requiresAuth: false },
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

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Perps to Awakens</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Convert perpetuals trading history to Awakens-compatible CSV
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 text-xs font-mono text-zinc-500">
        <span className={step === "select" ? "text-zinc-100" : ""}>1. Platform</span>
        <span>→</span>
        <span className={step === "input" ? "text-zinc-100" : ""}>2. Account</span>
        <span>→</span>
        <span className={step === "loading" ? "text-zinc-100" : ""}>3. Fetch</span>
        <span>→</span>
        <span className={step === "preview" ? "text-zinc-100" : ""}>4. Export</span>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800/50 rounded-lg text-red-300 text-sm font-mono whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Step 1: Platform selection */}
      {step === "select" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => p.ready && selectPlatform(p.id)}
              disabled={!p.ready}
              className={`p-4 rounded-lg border text-left transition-all ${
                p.ready
                  ? "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50 cursor-pointer"
                  : "border-zinc-800/50 opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="font-semibold">
                {p.name}
                {p.requiresAuth && (
                  <span className="ml-2 text-xs font-normal text-amber-500">API key</span>
                )}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {p.ready ? (p.hint || "Ready") : p.hint || "Coming soon"}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Account input */}
      {step === "input" && (
        <div className="max-w-lg">
          <label className="block text-sm text-zinc-400 mb-2">
            {platformName} — {currentPlatform?.hint || "wallet address"}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !needsAuth && fetchEvents()}
              placeholder={currentPlatform?.placeholder || "0x..."}
              spellCheck={false}
              className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg font-mono text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
            />
            {!needsAuth && (
              <button
                onClick={fetchEvents}
                disabled={!account.trim()}
                className="px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-semibold text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Fetch
              </button>
            )}
          </div>

          {/* API key fields for authenticated adapters */}
          {needsAuth && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-amber-950/30 border border-amber-900/40 rounded-lg text-xs text-amber-400">
                Your API credentials are sent directly to {platformName}&apos;s API from our server
                and are never stored or logged. Create a read-only API key for safety.
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your API key"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg font-mono text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">API Secret</label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
                  placeholder="Your API secret"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg font-mono text-sm focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={fetchEvents}
                disabled={!account.trim() || !apiKey.trim() || !apiSecret.trim()}
                className="w-full px-5 py-2.5 bg-zinc-100 text-zinc-900 rounded-lg font-semibold text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Fetch
              </button>
            </div>
          )}

          <button onClick={reset} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300">
            ← Back
          </button>
        </div>
      )}

      {/* Step 3: Loading */}
      {step === "loading" && (
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-100 rounded-full animate-spin" />
          <span>Fetching trade history from {platformName}...</span>
        </div>
      )}

      {/* Step 4: Preview + Export */}
      {step === "preview" && (
        <div>
          {/* Stats bar */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-400">
                <span className="text-zinc-100 font-semibold">{eventCount}</span> events from{" "}
                <span className="text-zinc-100">{platformName}</span>
              </span>
              {validationErrors.length > 0 && (
                <span className="text-red-400">
                  {validationErrors.length} validation error{validationErrors.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm border border-zinc-700 rounded-lg hover:bg-zinc-900 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={downloadCSV}
                disabled={validationErrors.length > 0}
                className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded-lg font-semibold hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Download CSV
              </button>
            </div>
          </div>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
              <div className="text-red-300 text-sm font-semibold mb-2">
                Export blocked — fix these errors:
              </div>
              <div className="space-y-1 text-xs font-mono text-red-400 max-h-40 overflow-y-auto">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <div key={i}>
                    Row {e.row}: [{e.field}] {e.message}
                  </div>
                ))}
                {validationErrors.length > 20 && (
                  <div className="text-zinc-500">
                    ... and {validationErrors.length - 20} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event table */}
          {events.length > 0 ? (
            <EventTable events={events} />
          ) : (
            <div className="text-zinc-500 text-center py-12">
              No events found for this account.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
