"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  PLATFORMS,
  PLATFORM_MODES,
  PLATFORM_DOCS,
  FAMILY_LABELS,
  modeLabel,
  type Platform,
} from "@/lib/data/platforms";

export default function PlatformsPage() {
  const [query, setQuery] = useState("");
  const [filterFamily, setFilterFamily] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "coming">("all");
  const [darkMode, setDarkMode] = useState(true);

  // Dark mode init
  useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme");
      setDarkMode(stored !== "light");
    }
  });

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  const families = useMemo(() => {
    const set = new Set(PLATFORMS.map((p) => p.family));
    return [...set].sort();
  }, []);

  const filtered = useMemo(() => {
    let result = PLATFORMS;

    if (filterStatus === "ready") result = result.filter((p) => p.ready);
    if (filterStatus === "coming") result = result.filter((p) => !p.ready);

    if (filterFamily !== "all") result = result.filter((p) => p.family === filterFamily);

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.family.toLowerCase().includes(q) ||
          p.hint.toLowerCase().includes(q)
      );
    }

    return result;
  }, [query, filterFamily, filterStatus]);

  const groupedByFamily = useMemo(() => {
    const groups: Record<string, Platform[]> = {};
    filtered.forEach((p) => {
      if (!groups[p.family]) groups[p.family] = [];
      groups[p.family].push(p);
    });
    return groups;
  }, [filtered]);

  const readyCount = PLATFORMS.filter((p) => p.ready).length;
  const comingCount = PLATFORMS.filter((p) => !p.ready).length;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
      {/* Header */}
      <div className="mb-8 sm:mb-14 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-md bg-[var(--accent-dim)] border border-[var(--accent-border)] flex items-center justify-center hover:bg-[var(--accent-border)] transition-colors">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-[var(--text-tertiary)]">Platform Coverage</span>
          </div>
          <button
            onClick={toggleDarkMode}
            className="theme-toggle"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          />
        </div>
        <h1 className="text-3xl sm:text-[2.5rem] font-bold tracking-[-0.03em] text-[var(--text-primary)] mb-1 leading-[1.15]">
          All Platforms
        </h1>
        <div className="w-12 h-[2px] bg-gradient-to-r from-[var(--accent)] to-transparent rounded-full mb-4" />
        <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
          {PLATFORMS.length} platforms tracked. {readyCount} ready for export, {comingCount} coming soon.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8 animate-fade-in">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platforms..."
            spellCheck={false}
            className="w-full pl-9 pr-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent-border)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "all" | "ready" | "coming")}
          className="px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
        >
          <option value="all">All ({PLATFORMS.length})</option>
          <option value="ready">Ready ({readyCount})</option>
          <option value="coming">Coming Soon ({comingCount})</option>
        </select>

        <select
          value={filterFamily}
          onChange={(e) => setFilterFamily(e.target.value)}
          className="px-3 py-2.5 bg-[var(--surface-2)] border border-[var(--border-medium)] rounded-lg font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
        >
          <option value="all">All Families</option>
          {families.map((f) => (
            <option key={f} value={f}>{FAMILY_LABELS[f] || f}</option>
          ))}
        </select>

        <span className="text-[11px] font-mono text-[var(--text-tertiary)] ml-auto">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Platform grid grouped by family */}
      {Object.keys(groupedByFamily).length === 0 ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">No platforms match your filters</p>
        </div>
      ) : (
        <div className="space-y-10 animate-fade-in-up">
          {Object.entries(groupedByFamily).map(([family, platforms]) => (
            <div key={family}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] font-mono font-semibold tracking-widest uppercase text-[var(--text-tertiary)]">
                  {FAMILY_LABELS[family] || family}
                </span>
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{platforms.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {platforms.map((p) => {
                  const mode = modeLabel(PLATFORM_MODES[p.id] || "strict");
                  const doc = PLATFORM_DOCS[p.id];

                  return (
                    <div
                      key={p.id}
                      className={`platform-card p-4 rounded-lg border bg-[var(--surface-1)] transition-all duration-200 ${
                        p.ready
                          ? "border-[var(--border-subtle)] hover:border-[var(--accent-border)]"
                          : "border-[var(--border-subtle)] opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{p.name}</span>
                        <div className="flex items-center gap-1.5">
                          {p.ready ? (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                              Ready
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 uppercase tracking-wider">
                              Coming Soon
                            </span>
                          )}
                          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${mode.bg} ${mode.color} border ${mode.border} uppercase tracking-wider`}>
                            {mode.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-2">{p.hint}</div>

                      {p.requiresAuth && (
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] text-amber-400/80">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                          </svg>
                          Requires API key
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-[var(--text-tertiary)] mb-1">
                        <span className="opacity-50">ID:</span> {p.id}
                      </div>

                      {doc && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-[11px]">
                          <div>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--accent)] mr-1.5">Supported</span>
                            <span className="text-[var(--text-secondary)]">{doc.supported.join(" / ")}</span>
                          </div>
                          <div>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-red-500 mr-1.5">Blocked</span>
                            <span className="text-[var(--text-tertiary)]">{doc.blocked.join(" / ")}</span>
                          </div>
                          <div className="text-[var(--text-tertiary)] italic text-[10px] pt-1">{doc.why}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-16 text-center animate-fade-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold text-sm hover:brightness-110 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Export your data
        </Link>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-6 pb-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)] tracking-wide">
          <span>Awakens Exporter &middot; Correctness-first accounting</span>
          <span className="uppercase">Protocol events only</span>
        </div>
      </footer>
    </main>
  );
}
