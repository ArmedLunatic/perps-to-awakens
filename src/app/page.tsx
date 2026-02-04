"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { AwakensEvent, ValidationError, ClassifiedError } from "@/lib/core/types";
import { generateCSV } from "@/lib/core/csv";
import EventTable from "@/components/EventTable";
import CommandPalette from "@/components/CommandPalette";
import ErrorAlert from "@/components/ErrorAlert";
import WizardStepIndicator from "@/components/WizardStepIndicator";
import LoadingStep from "@/components/LoadingStep";
import {
  PLATFORMS,
  PLATFORM_MODES,
  PLATFORM_DOCS,
  REFUSAL_TOOLTIPS,
  detectPlatformsForAddress,
  modeLabel,
  type Platform,
} from "@/lib/data/platforms";

// ─── Wizard steps ───
type Step = "address" | "detect" | "credentials" | "loading" | "preview";

const ITEMS_PER_PAGE = 25;

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
  const [detectedPlatforms, setDetectedPlatforms] = useState<Platform[]>([]);
  const [skipAuth, setSkipAuth] = useState(false);

  // ─── Preview state ───
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof AwakensEvent>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterYear, setFilterYear] = useState<string>("all");

  // ─── Dark mode state ───
  const [darkMode, setDarkMode] = useState(true);

  // ─── Batch state ───
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<Record<string, {
    events: AwakensEvent[];
    validationErrors: ValidationError[];
    error?: string;
    mode?: string;
  }>>({});
  const [batchMode, setBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState<Record<string, "pending" | "loading" | "done" | "error">>({});

  // ─── Post-export guidance state ───
  const [showImportGuide, setShowImportGuide] = useState(false);

  // ─── Command palette state ───
  const [platformSearchOpen, setPlatformSearchOpen] = useState(false);
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

  const allReadyPlatforms = useMemo(() => PLATFORMS.filter((p) => p.ready), []);

  // ─── Address format detection ───
  const addressHint = useMemo(() => {
    const addr = account.trim();
    if (addr.length < 8) return null;
    const detected = detectPlatformsForAddress(addr);
    // Derive format name from prefix
    let format: string | null = null;
    if (addr.startsWith("0x")) format = "EVM";
    else if (addr.startsWith("cosmos1")) format = "Cosmos";
    else if (addr.startsWith("osmo1")) format = "Osmosis";
    else if (addr.startsWith("juno1")) format = "Juno";
    else if (addr.startsWith("stars1")) format = "Stargaze";
    else if (addr.startsWith("terra1")) format = "Terra";
    else if (addr.startsWith("sei1")) format = "Sei";
    else if (addr.startsWith("inj1")) format = "Injective";
    else if (addr.startsWith("tz1") || addr.startsWith("tz2") || addr.startsWith("tz3") || addr.startsWith("KT1")) format = "Tezos";
    else if (addr.startsWith("stake1") || addr.startsWith("addr1")) format = "Cardano";
    else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) format = "Solana/Base58";
    else if (/^[0-9a-f]{64}$/i.test(addr)) format = "Substrate/Hex";
    else if (detected.length > 0) format = "Detected";
    if (format && detected.length > 0) {
      return { match: true, format, count: detected.length };
    }
    return { match: false, format: null, count: 0 };
  }, [account]);

  // ─── Summary statistics for preview ───
  const summaryStats = useMemo(() => {
    if (events.length === 0) return null;
    // Date range
    const dates = events.map((e) => e.date);
    const earliest = dates[0] || "";
    const latest = dates[dates.length - 1] || "";
    // Unique assets
    const assets = new Set(events.map((e) => e.asset));
    // Tag breakdown
    const tagCounts: Record<string, number> = {};
    events.forEach((e) => { tagCounts[e.tag] = (tagCounts[e.tag] || 0) + 1; });
    // Total fees
    const totalFees = events.reduce((sum, e) => sum + e.fee, 0);
    return { earliest, latest, assetCount: assets.size, tagCounts, totalFees };
  }, [events]);

  // ─── Wizard back-navigation handler ───
  function handleWizardNavigate(targetStep: Step) {
    const STEP_ORDER: Step[] = ["address", "detect", "credentials", "loading", "preview"];
    const currentIndex = STEP_ORDER.indexOf(step);
    const targetIndex = STEP_ORDER.indexOf(targetStep);
    // Only allow backward navigation
    if (targetIndex < currentIndex) {
      clearError();
      setStep(targetStep);
    }
  }

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
    // If a platform was pre-selected via quick-start, skip detection
    if (platform) {
      const plat = PLATFORMS.find((p) => p.id === platform);
      if (plat?.requiresAuth) {
        setSkipAuth(false);
        setStep("credentials");
      } else {
        setSkipAuth(true);
        fetchEventsForPlatform(platform);
      }
      clearError();
      return;
    }
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

  // ─── Batch fetch ───
  async function fetchBatchEvents(platformIds: string[]) {
    if (!account.trim() || platformIds.length === 0) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep("loading");
    setBatchMode(true);
    clearError();
    setTruncated(false);

    const progress: Record<string, "pending" | "loading" | "done" | "error"> = {};
    platformIds.forEach((id) => { progress[id] = "loading"; });
    setBatchProgress({ ...progress });

    const results = await Promise.allSettled(
      platformIds.map(async (id) => {
        const body: Record<string, string> = { platform: id, account: account.trim() };
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const data = await res.json();

        if (!res.ok) {
          progress[id] = "error";
          setBatchProgress({ ...progress });
          return { id, error: data.error || `HTTP ${res.status}`, events: [] as AwakensEvent[], validationErrors: [] as ValidationError[] };
        }

        progress[id] = "done";
        setBatchProgress({ ...progress });
        return { id, events: data.events as AwakensEvent[], validationErrors: (data.validationErrors || []) as ValidationError[], mode: PLATFORM_MODES[id] || "strict" };
      })
    );

    if (controller.signal.aborted) return;

    const batchRes: typeof batchResults = {};
    let allEvents: AwakensEvent[] = [];
    let allErrors: ValidationError[] = [];
    let failedCount = 0;

    results.forEach((result, i) => {
      const id = platformIds[i];
      if (result.status === "fulfilled") {
        const data = result.value;
        batchRes[data.id] = {
          events: data.events,
          validationErrors: data.validationErrors,
          error: data.error,
          mode: data.mode,
        };
        if (!data.error) {
          allEvents = allEvents.concat(data.events);
          // Offset validation error rows for merged view
          const offset = allEvents.length - data.events.length;
          allErrors = allErrors.concat(data.validationErrors.map((e) => ({ ...e, row: e.row + offset })));
        } else {
          failedCount++;
        }
      } else {
        batchRes[id] = { events: [], validationErrors: [], error: "Request failed" };
        failedCount++;
      }
    });

    // Deduplicate by txHash (keep first occurrence)
    const seen = new Set<string>();
    const deduped: AwakensEvent[] = [];
    allEvents.forEach((e) => {
      if (!seen.has(e.txHash)) {
        seen.add(e.txHash);
        deduped.push(e);
      }
    });

    setBatchResults(batchRes);
    setEvents(deduped);
    setValidationErrors(allErrors);
    setEventCount(deduped.length);
    setSearchQuery("");
    setCurrentPage(1);

    if (deduped.length > 0) {
      setStep("preview");
    } else {
      setError(`All ${failedCount} platform${failedCount !== 1 ? "s" : ""} failed to return events.`);
      setStep("detect");
      setBatchMode(false);
    }

    if (abortControllerRef.current === controller) {
      abortControllerRef.current = null;
    }
  }

  function togglePlatformSelection(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function selectAllDetected() {
    const nonAuth = detectedPlatforms.filter((p) => !p.requiresAuth).map((p) => p.id);
    setSelectedPlatforms(nonAuth);
  }

  function deselectAll() {
    setSelectedPlatforms([]);
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
      const prefix = batchMode ? "batch" : platform;
      a.download = `${prefix}-awakens${yearSuffix}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowImportGuide(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "CSV generation failed");
    }
  }

  function copyCSVToClipboard() {
    try {
      const csv = generateCSV(exportEvents);
      navigator.clipboard.writeText(csv);
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
    const prefix = batchMode ? "batch" : platform;
    a.download = `${prefix}-awakens${yearSuffix}-${Date.now()}.json`;
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
    setSelectedPlatforms([]);
    setBatchResults({});
    setBatchMode(false);
    setBatchProgress({});
    setShowImportGuide(false);
  }

  // ─── Helpers ───

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
            Export to<br className="hidden sm:block" /> Awaken Tax
          </h1>
          <div className="w-12 h-[2px] bg-gradient-to-r from-[var(--accent)] to-transparent rounded-full mb-4" />
          <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
            Companion tool for{" "}
            <a href="https://awaken.tax" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Awaken Tax</a>.
            Exports provable on-chain events as Awaken-compatible CSV — ready to import.
          </p>
        </div>
      </div>

      {/* ─── Step indicator ─── */}
      {step !== "address" && (
        <WizardStepIndicator currentStep={step} skipAuth={skipAuth} onNavigate={handleWizardNavigate} />
      )}

      {/* ─── Error display ─── */}
      <ErrorAlert error={error} classifiedError={classifiedError} onRetry={fetchEvents} />

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

          {/* Quick-start chips */}
          <div className="max-w-lg mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Quick Start</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)]">
                {allReadyPlatforms.length} platforms across perps, staking, and L1s
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { id: "hyperliquid", label: "Hyperliquid Trades" },
                { id: "dydx", label: "dYdX Perps" },
                { id: "polkadot", label: "Polkadot Staking" },
                { id: "cosmoshub", label: "Cosmos Rewards" },
                { id: "tezos", label: "Tezos Baking" },
                { id: "near", label: "NEAR Staking" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => {
                    setPlatform(chip.id);
                    addressInputRef.current?.focus();
                  }}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-all duration-200 ${
                    platform === chip.id
                      ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent-border)]"
                      : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--accent-border)] hover:text-[var(--accent)]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
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
            {/* Address format hint */}
            {addressHint && (
              <div className="mt-2.5 flex items-center gap-2 text-[12px] animate-fade-in">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${addressHint.match ? "bg-[var(--accent)]" : "bg-amber-400"}`} />
                {addressHint.match ? (
                  <span className="text-[var(--text-secondary)]">
                    Looks like a <span className="text-[var(--accent)] font-medium">{addressHint.format}</span> address — {addressHint.count} platform{addressHint.count !== 1 ? "s" : ""} available
                  </span>
                ) : (
                  <span className="text-amber-400/80">Format not recognized — browse platforms manually</span>
                )}
              </div>
            )}
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={() => setPlatformSearchOpen(true)}
                className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Or browse all platforms
                <span className="hidden sm:inline ml-1 opacity-60">
                  <kbd className="palette-kbd text-[9px] px-1">Ctrl+K</kbd>
                </span>
              </button>
              <Link
                href="/platforms"
                className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                View all {PLATFORMS.length} platforms
              </Link>
            </div>
          </div>

          {/* Correctness guarantees & eligibility (collapsed) */}
          <details className="mb-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] group/details">
            <summary className="flex items-center gap-2.5 px-5 py-4 cursor-pointer select-none list-none">
              <svg className="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 group-open/details:rotate-90 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">How it works</span>
              <span className="text-[11px] text-[var(--text-tertiary)]">— Correctness guarantees & eligibility</span>
            </summary>
            <div className="px-5 pb-5 pt-1 border-t border-[var(--border-subtle)]">
              {/* Refusals */}
              <div className="mb-6 mt-4">
                <div className="flex items-center gap-2 mb-3">
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
                <p className="mt-3 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                  Skipped for accuracy — inferred events are blocked to avoid audit risk.
                </p>
              </div>
              {/* Eligibility criteria */}
              <div>
                <div className="flex items-center gap-2 mb-3">
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
                    <div key={i} className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)]">
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
          </details>
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
              <p className="text-[12px] text-[var(--text-tertiary)] mb-3 leading-relaxed">
                {detectedPlatforms.length >= 2
                  ? <>Click a platform for single export, or check multiple for batch export. Address <span className="font-mono text-[var(--text-secondary)]">{account.slice(0, 12)}...{account.slice(-6)}</span></>
                  : <>Select the platform where your activity occurred. The address <span className="font-mono text-[var(--text-secondary)]">{account.slice(0, 12)}...{account.slice(-6)}</span> matches these platforms.</>
                }
              </p>

              {/* Batch controls */}
              {detectedPlatforms.length >= 2 && (
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={selectedPlatforms.length === detectedPlatforms.filter((p) => !p.requiresAuth).length ? deselectAll : selectAllDetected}
                    className="text-[11px] font-mono text-[var(--accent)] hover:underline"
                  >
                    {selectedPlatforms.length === detectedPlatforms.filter((p) => !p.requiresAuth).length ? "Deselect All" : "Select All"}
                  </button>
                  {selectedPlatforms.length >= 2 && (
                    <button
                      onClick={() => fetchBatchEvents(selectedPlatforms)}
                      className="btn-primary relative px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-semibold text-[12px] hover:brightness-110 transition-all duration-200"
                    >
                      <span className="relative z-10">Fetch {selectedPlatforms.length} platforms</span>
                    </button>
                  )}
                  {selectedPlatforms.length > 0 && selectedPlatforms.length < 2 && (
                    <span className="text-[10px] text-[var(--text-tertiary)]">Select 2+ for batch</span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
                {detectedPlatforms.map((p) => {
                  const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
                  const isSelected = selectedPlatforms.includes(p.id);
                  const showCheckbox = detectedPlatforms.length >= 2;
                  return (
                    <div
                      key={p.id}
                      className={`platform-card p-4 rounded-lg border bg-[var(--surface-1)] text-left transition-all duration-200 group ${
                        isSelected ? "border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]" : "border-[var(--border-subtle)] hover:border-[var(--accent-border)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {showCheckbox && (
                          <label className="flex-shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={p.requiresAuth}
                              onChange={() => togglePlatformSelection(p.id)}
                              className="w-3.5 h-3.5 rounded border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:ring-offset-0 disabled:opacity-30"
                            />
                          </label>
                        )}
                        <button
                          onClick={() => selectPlatform(p.id)}
                          className="flex-1 text-left"
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
                              {showCheckbox ? "Requires credentials — skipped in batch" : "Requires API key"}
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
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

          <div className="flex items-center gap-4">
            <button onClick={() => { setStep("address"); clearError(); }} className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Change address
            </button>
            <Link
              href="/platforms"
              className="flex items-center gap-1.5 text-[12px] font-mono text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors duration-200"
            >
              View all {PLATFORMS.length} platforms
            </Link>
          </div>
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
        <LoadingStep platformName={platformName} onCancel={cancelFetch} batchProgress={batchMode ? batchProgress : undefined} />
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
              <span className="text-[var(--text-secondary)] font-medium text-[13px]">
                {batchMode ? (() => {
                  const successful = Object.entries(batchResults).filter(([, r]) => !r.error);
                  const failed = Object.entries(batchResults).filter(([, r]) => r.error);
                  return `${successful.length} platform${successful.length !== 1 ? "s" : ""}${failed.length > 0 ? ` (${failed.length} failed)` : ""}`;
                })() : platformName}
              </span>
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
                title="Awakens-compatible format"
                className="group btn-primary relative px-5 py-2.5 text-[13px] font-semibold bg-[var(--accent)] text-white rounded-lg hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span className="relative z-10">Export CSV</span>
              </button>
              {/* Copy CSV to clipboard */}
              <button
                onClick={copyCSVToClipboard}
                disabled={validationErrors.length > 0}
                title="Copy CSV to clipboard"
                className="px-3 py-2 text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-tertiary)] rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </button>
              {/* JSON export */}
              <button
                onClick={downloadJSON}
                disabled={validationErrors.length > 0}
                className="px-3 py-2 text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-tertiary)] rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text-secondary)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
              >
                JSON
              </button>
            </div>
          </div>

          {/* Post-export: Import into Awaken Tax guidance */}
          {showImportGuide && (
            <div className="p-5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] animate-fade-in relative">
              <button
                onClick={() => setShowImportGuide(false)}
                className="absolute top-3 right-3 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-emerald-300 text-sm font-semibold mb-2">Your CSV is ready to import into Awaken Tax</div>
                  <ol className="text-[12px] text-emerald-300/80 leading-relaxed space-y-1.5 list-decimal list-inside">
                    <li>Open <a href="https://awaken.tax" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Awaken Tax</a> and go to <span className="font-mono font-medium text-emerald-300">Imports &rarr; Custom CSV</span></li>
                    <li>Upload the CSV file you just downloaded</li>
                    <li>Columns are pre-mapped to Awaken&apos;s expected format — no manual mapping needed</li>
                  </ol>
                  <div className="mt-3 text-[11px] text-emerald-400/60">
                    CSV columns: Date, Asset, Amount, Fee, P&amp;L, Payment Token, Notes, Transaction Hash, Tag
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pre-export summary */}
          {exportEvents.length > 0 && validationErrors.length === 0 && (
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] animate-fade-in">
              <div className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)] mb-3">Export Preview</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[12px] font-mono">
                <div>
                  <span className="text-[var(--text-tertiary)]">Filename </span>
                  <span className="text-[var(--text-secondary)] break-all">{batchMode ? "batch" : platform}-awakens{filterYear !== "all" ? `-${filterYear}` : ""}-*.csv</span>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Rows </span>
                  <span className="text-[var(--accent)] font-semibold">{exportEvents.length}</span>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Range </span>
                  <span className="text-[var(--text-secondary)]">
                    {exportEvents[0]?.date.split(" ")[0] || "—"} — {exportEvents[exportEvents.length - 1]?.date.split(" ")[0] || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-tertiary)]">Year </span>
                  <span className="text-[var(--text-secondary)]">{filterYear === "all" ? "All" : filterYear}</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] font-mono text-[var(--text-tertiary)]">
                Columns: Date, Asset, Amount, Fee, P&amp;L, Payment Token, Notes, Transaction Hash, Tag
              </div>
            </div>
          )}

          {/* Summary statistics */}
          {summaryStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
              <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Date Range</div>
                <div className="text-[12px] font-mono text-[var(--text-secondary)] leading-snug">
                  {summaryStats.earliest.split(" ")[0] || "—"}
                  <span className="text-[var(--text-tertiary)]"> — </span>
                  {summaryStats.latest.split(" ")[0] || "—"}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Assets</div>
                <div className="text-[12px] font-mono text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)] font-bold text-sm">{summaryStats.assetCount}</span> unique
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summaryStats.tagCounts).map(([tag, count]) => {
                    const dotColors: Record<string, string> = {
                      open_position: "bg-blue-400",
                      close_position: "bg-teal-400",
                      funding_payment: "bg-amber-400",
                      staking_reward: "bg-violet-400",
                      slashing: "bg-rose-400",
                    };
                    return (
                      <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-tertiary)]">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[tag] || "bg-zinc-500"}`} />
                        {count} {tag.replace(/_/g, " ")}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Total Fees</div>
                <div className="text-[12px] font-mono text-[var(--text-secondary)]">
                  {summaryStats.totalFees.toFixed(8).replace(/\.?0+$/, "") || "0"}
                </div>
              </div>
            </div>
          )}

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

          {/* Batch results summary */}
          {batchMode && Object.keys(batchResults).length > 0 && (
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] animate-fade-in">
              <div className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)] mb-3">Batch Results</div>
              <div className="space-y-1.5">
                {Object.entries(batchResults).map(([id, result]) => {
                  const plat = PLATFORMS.find((p) => p.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 text-[12px]">
                      {result.error ? (
                        <svg className="w-3 h-3 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      <span className={result.error ? "text-red-400" : "text-[var(--text-secondary)]"}>
                        {plat?.name || id}
                      </span>
                      {result.error ? (
                        <span className="text-red-400/60 text-[10px] ml-1">{result.error}</span>
                      ) : (
                        <span className="text-[var(--text-tertiary)] text-[10px] ml-1">{result.events.length} events</span>
                      )}
                      {result.error && (
                        <button
                          onClick={() => { setPlatform(id); fetchEventsForPlatform(id); setBatchMode(false); }}
                          className="ml-auto text-[10px] font-mono text-[var(--accent)] hover:underline"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  );
                })}
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
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5">No qualifying events found</h3>
                <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed mb-1">
                  No exportable events were returned for this address. This usually means:
                </p>
                <ul className="text-[12px] text-[var(--text-tertiary)] leading-relaxed mb-4 space-y-0.5 text-left max-w-xs mx-auto">
                  <li className="flex items-start gap-2"><span className="mt-[6px] w-1 h-1 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />The account has no staking rewards, trades, or slashing events</li>
                  <li className="flex items-start gap-2"><span className="mt-[6px] w-1 h-1 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />The address format may not match this platform</li>
                  <li className="flex items-start gap-2"><span className="mt-[6px] w-1 h-1 rounded-full bg-[var(--text-tertiary)] flex-shrink-0" />The account may be too new to have recorded activity</li>
                </ul>
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

      {/* ─── Command Palette ─── */}
      <CommandPalette
        open={platformSearchOpen}
        onClose={() => setPlatformSearchOpen(false)}
        onSelect={selectPlatform}
      />

      {/* ─── Footer ─── */}
      <footer className="mt-20 pt-6 pb-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)] tracking-wide">
          <span>Awakens Exporter &middot; Correctness-first accounting</span>
          <div className="flex items-center gap-3">
            <a href="https://awaken.tax" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">Awaken Tax</a>
            <span className="uppercase">Protocol events only</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
