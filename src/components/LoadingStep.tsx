"use client";

import { PLATFORMS } from "@/lib/data/platforms";

export default function LoadingStep({
  platformName,
  onCancel,
  batchProgress,
}: {
  platformName: string;
  onCancel: () => void;
  batchProgress?: Record<string, "pending" | "loading" | "done" | "error">;
}) {
  const isBatch = batchProgress && Object.keys(batchProgress).length > 0;

  return (
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
        <div className="text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {isBatch ? "Fetching from multiple platforms" : "Fetching accounting events"}
        </div>
        {!isBatch && (
          <div className="text-[12px] font-mono text-[var(--text-tertiary)]">{platformName}</div>
        )}

        {isBatch && (
          <div className="mt-3 space-y-1.5 text-left max-w-xs mx-auto">
            {Object.entries(batchProgress).map(([id, status]) => {
              const plat = PLATFORMS.find((p) => p.id === id);
              return (
                <div key={id} className="flex items-center gap-2 text-[12px] font-mono">
                  {status === "loading" && (
                    <div className="w-3 h-3 rounded-full border border-transparent border-t-[var(--accent)]" style={{ animation: "spin 0.9s linear infinite" }} />
                  )}
                  {status === "done" && (
                    <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  {status === "error" && (
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                  {status === "pending" && (
                    <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                  )}
                  <span className={status === "done" ? "text-[var(--text-secondary)]" : status === "error" ? "text-red-400" : "text-[var(--text-tertiary)]"}>
                    {plat?.name || id}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!isBatch && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-[var(--accent)]" style={{ animation: "breathe 1.2s ease-in-out infinite", animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        )}
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-2 text-[12px] font-medium border border-[var(--border-subtle)] rounded-md text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
