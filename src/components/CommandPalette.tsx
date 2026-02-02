"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  PLATFORMS,
  PLATFORM_MODES,
  FAMILY_LABELS,
  modeLabel,
  type Platform,
} from "@/lib/data/platforms";

export default function CommandPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (platformId: string) => void;
}) {
  const [platformQuery, setPlatformQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paletteBodyRef = useRef<HTMLDivElement>(null);

  const allReadyPlatforms = useMemo(() => PLATFORMS.filter((p) => p.ready), []);

  const filteredForSearch = useMemo(() => {
    if (!platformQuery.trim()) return allReadyPlatforms;
    const q = platformQuery.toLowerCase();
    return allReadyPlatforms.filter(
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

    const familyGroups: Record<string, Platform[]> = {};
    ready.forEach((p) => {
      if (!familyGroups[p.family]) familyGroups[p.family] = [];
      familyGroups[p.family].push(p);
    });

    return { familyGroups, notReady };
  }, [filteredForSearch, platformQuery]);

  const flatResults = useMemo(() => {
    const items: Platform[] = [];
    Object.values(groupedResults.familyGroups).forEach((group) => items.push(...group));
    items.push(...groupedResults.notReady);
    return items;
  }, [groupedResults]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
      document.body.style.overflow = "hidden";
    } else {
      setPlatformQuery("");
      setActiveIndex(0);
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [platformQuery]);

  useEffect(() => {
    if (!open || !paletteBodyRef.current) return;
    const activeEl = paletteBodyRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const handleKeyDown = useCallback(
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
        if (item && item.ready) onSelect(item.id);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [flatResults, activeIndex, onSelect, onClose]
  );

  if (!open) return null;

  return (
    <>
      <div className="palette-backdrop" onClick={onClose} />
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
              onKeyDown={handleKeyDown}
              placeholder="Search platforms..."
              spellCheck={false}
              autoComplete="off"
            />
            <button
              onClick={onClose}
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
                    onClick={() => onSelect(p.id)}
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
  );
}
