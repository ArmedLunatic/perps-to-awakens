"use client";

type Step = "address" | "detect" | "credentials" | "loading" | "preview";

const STEP_META = [
  { key: "address", label: "Address", short: "Addr", num: "01" },
  { key: "detect", label: "Platform", short: "Pick", num: "02" },
  { key: "credentials", label: "Auth", short: "Auth", num: "03" },
  { key: "loading", label: "Fetch", short: "Load", num: "04" },
  { key: "preview", label: "Export", short: "Done", num: "05" },
] as const;

const STEP_ORDER: Step[] = ["address", "detect", "credentials", "loading", "preview"];

export default function WizardStepIndicator({
  currentStep,
  skipAuth,
  onNavigate,
}: {
  currentStep: Step;
  skipAuth: boolean;
  onNavigate?: (step: Step) => void;
}) {
  const stepIndex = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="step-indicator-wrap flex items-center gap-1 mb-8 sm:mb-10 animate-fade-in">
      {STEP_META.map((s, i) => {
        const isActive = currentStep === s.key;
        const isPast = stepIndex > i;
        const isSkipped = s.key === "credentials" && skipAuth && !isActive;
        const canNavigate = isPast && onNavigate;

        const inner = (
          <>
            <span className="opacity-50">{s.num}</span>
            <span className="font-medium sm:hidden">{s.short}</span>
            <span className="font-medium hidden sm:inline">{s.label}</span>
          </>
        );

        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && <div className={`w-4 sm:w-8 h-px mx-0.5 sm:mx-1 ${isPast || isActive ? "bg-[var(--accent)]" : isSkipped ? "bg-[var(--border-medium)] opacity-40" : "bg-[var(--border-subtle)]"}`} />}
            {canNavigate ? (
              <button
                onClick={() => onNavigate(s.key as Step)}
                className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-mono transition-all whitespace-nowrap text-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] cursor-pointer`}
              >
                {inner}
              </button>
            ) : (
              <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-mono transition-all whitespace-nowrap ${
                isActive
                  ? "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)]"
                  : isPast
                  ? "text-[var(--accent)]"
                  : isSkipped
                  ? "text-[var(--text-tertiary)] opacity-40 line-through"
                  : "text-[var(--text-tertiary)]"
              }`}>
                {inner}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
