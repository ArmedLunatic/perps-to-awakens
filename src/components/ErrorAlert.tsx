"use client";

import { ClassifiedError } from "@/lib/core/types";

export default function ErrorAlert({
  error,
  classifiedError,
  onRetry,
  onDismiss,
}: {
  error: string;
  classifiedError: ClassifiedError | null;
  onRetry: () => void;
  onDismiss?: () => void;
}) {
  if (!error) return null;

  return (
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
                  onClick={onRetry}
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
  );
}
