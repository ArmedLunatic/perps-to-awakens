"use client";

import React, { useState, useMemo } from "react";
import { AwakensEvent, ValidationError } from "@/lib/core/types";

type SortKey = keyof AwakensEvent;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right"; tooltip?: string }[] = [
  { key: "date", label: "Date", tooltip: "When the event occurred (UTC)" },
  { key: "asset", label: "Asset", tooltip: "The asset involved in this event" },
  { key: "amount", label: "Amount", align: "right", tooltip: "Quantity of the asset" },
  { key: "fee", label: "Fee", align: "right", tooltip: "Transaction or protocol fee" },
  { key: "pnl", label: "P&L", align: "right", tooltip: "Profit or loss from this event" },
  { key: "paymentToken", label: "Token", tooltip: "Token used for payment" },
  { key: "tag", label: "Type", tooltip: "Category of accounting event" },
  { key: "txHash", label: "Tx Hash", tooltip: "On-chain transaction identifier" },
];

function formatNum(n: number): string {
  if (n === 0) return "0";
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s;
}

type EventCategory = "Trading" | "Income" | "Expense";

function getEventCategory(tag: string): EventCategory {
  if (tag === "open_position" || tag === "close_position" || tag === "funding_payment") {
    return "Trading";
  }
  if (tag === "staking_reward") {
    return "Income";
  }
  if (tag === "slashing") {
    return "Expense";
  }
  return "Trading";
}

function TagBadge({ tag }: { tag: string }) {
  const config: Record<string, { bg: string; text: string; border: string; dot: string; tooltip?: string }> = {
    open_position: {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      dot: "bg-blue-500",
      tooltip: "Opening a new position",
    },
    close_position: {
      bg: "bg-teal-50",
      text: "text-teal-700",
      border: "border-teal-200",
      dot: "bg-teal-500",
      tooltip: "Closing a position",
    },
    funding_payment: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
      tooltip: "Funding payment (periodic fee)",
    },
    staking_reward: {
      bg: "bg-violet-50",
      text: "text-violet-700",
      border: "border-violet-200",
      dot: "bg-violet-500",
      tooltip: "Staking reward: income from validating or delegating",
    },
    slashing: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
      tooltip: "Slashing: penalty for validator misbehavior",
    },
  };

  const style = config[tag] || { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200", dot: "bg-zinc-400" };
  const label = tag.replace(/_/g, " ");

  return (
    <span
      className={`group/tooltip relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{label}</span>
      {style.tooltip && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-10 px-2.5 py-1.5 text-[10px] font-normal normal-case tracking-normal text-[var(--text-primary)] bg-[var(--surface-3)] border border-[var(--border-medium)] rounded-md whitespace-nowrap pointer-events-none shadow-xl">
          {style.tooltip}
        </span>
      )}
    </span>
  );
}

function PnLCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-[var(--text-tertiary)]">0</span>;
  const color = value > 0 ? "text-emerald-600" : "text-red-600";
  const prefix = value > 0 ? "+" : "";
  return <span className={color}>{prefix}{formatNum(value)}</span>;
}

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <span className="group/tooltip relative inline-flex items-center">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-20 px-2.5 py-1.5 text-[10px] font-normal text-[var(--text-primary)] bg-[var(--surface-3)] border border-[var(--border-medium)] rounded-md whitespace-nowrap pointer-events-none shadow-xl">
        {content}
      </span>
    </span>
  );
}

export default function EventTable({
  events,
  validationErrors = [],
  platformMode = "strict",
}: {
  events: AwakensEvent[];
  validationErrors?: ValidationError[];
  platformMode?: "strict" | "assisted" | "partial" | "blocked";
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [groupByCategory, setGroupByCategory] = useState(true);

  const errorMap = useMemo(() => {
    const map = new Map<number, ValidationError[]>();
    validationErrors.forEach((err) => {
      const existing = map.get(err.row) || [];
      map.set(err.row, [...existing, err]);
    });
    return map;
  }, [validationErrors]);

  const sorted = useMemo(() => {
    return [...events].map((event, idx) => ({ event, originalIndex: idx + 1 })).sort((a, b) => {
      const aVal = a.event[sortKey];
      const bVal = b.event[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [events, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (!groupByCategory) {
      return { Trading: sorted, Income: [], Expense: [] };
    }
    const groups: Record<EventCategory, Array<{ event: AwakensEvent; originalIndex: number }>> = {
      Trading: [],
      Income: [],
      Expense: [],
    };
    sorted.forEach((item) => {
      const category = getEventCategory(item.event.tag);
      groups[category].push(item);
    });
    return groups;
  }, [sorted, groupByCategory]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleRow(index: number) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  }

  function renderTable(
    eventsToRender: Array<{ event: AwakensEvent; originalIndex: number }>,
    displayIndexOffset: number = 0
  ) {
    return (
      <table className="data-table w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-medium)]">
            <th className="w-10 px-3"></th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 cursor-pointer select-none whitespace-nowrap transition-colors duration-150 hover:text-[var(--text-primary)] ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${sortKey === col.key ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}
              >
                <div className={`flex items-center gap-1.5 ${col.align === "right" ? "justify-end" : ""}`}>
                  {col.tooltip ? (
                    <Tooltip content={col.tooltip}>
                      <span>{col.label}</span>
                    </Tooltip>
                  ) : (
                    <span>{col.label}</span>
                  )}
                  {sortKey === col.key && (
                    <span className="text-[9px] text-[var(--accent)]">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eventsToRender.map((item, i) => {
            const { event, originalIndex } = item;
            const displayIndex = displayIndexOffset + i;
            const rowErrors = errorMap.get(originalIndex) || [];
            const isExpanded = expandedRows.has(displayIndex);
            const hasErrors = rowErrors.length > 0;

            return (
              <React.Fragment key={`${event.txHash}-${displayIndex}`}>
                <tr
                  className={`border-b border-[var(--border-subtle)] transition-colors duration-150 ${
                    hasErrors
                      ? "bg-red-50/60 hover:bg-red-50"
                      : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggleRow(displayIndex)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150 focus:outline-none rounded"
                      aria-label={isExpanded ? "Collapse row" : "Expand row"}
                    >
                      {isExpanded ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--text-tertiary)]">
                    {event.date}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-primary)] font-semibold">{event.asset}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{formatNum(event.amount)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-tertiary)]">{formatNum(event.fee)}</td>
                  <td className="px-4 py-3 text-right">
                    <PnLCell value={event.pnl} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)]">{event.paymentToken}</td>
                  <td className="px-4 py-3">
                    <TagBadge tag={event.tag} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)] max-w-[180px] truncate" title={event.txHash}>
                    {event.txHash}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-[var(--surface-1)] border-b border-[var(--border-subtle)]">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="space-y-3 text-[11px] font-mono leading-relaxed ml-7">
                        {event.notes && (
                          <div className="pb-2 border-b border-[var(--border-subtle)]">
                            <div className="text-[var(--text-tertiary)] font-semibold mb-1 uppercase tracking-wider text-[9px]">Notes</div>
                            <div className="text-[var(--text-secondary)]">{event.notes}</div>
                          </div>
                        )}
                        {hasErrors && (
                          <div className="pt-2">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="text-red-600 font-semibold text-[9px] uppercase tracking-wider">Validation errors</div>
                            </div>
                            <div className="space-y-1 text-red-600 pl-6">
                              {rowErrors.map((err, idx) => (
                                <div key={idx}>[{err.field}] {err.message}</div>
                              ))}
                            </div>
                            <div className="text-red-500 mt-2 pl-6">Cannot export until resolved.</div>
                          </div>
                        )}
                        {platformMode === "assisted" && !hasErrors && (
                          <div className="pt-2 text-amber-600">
                            Assisted Mode — review for accuracy before export.
                          </div>
                        )}
                        {!event.notes && !hasErrors && platformMode !== "assisted" && (
                          <div className="text-[var(--text-tertiary)] italic">
                            No additional details.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    );
  }

  const categoryLabels: Record<EventCategory, { label: string; dot: string; description: string }> = {
    Trading: { label: "Trading", dot: "bg-blue-500", description: "Position opens, closes, and funding payments" },
    Income: { label: "Income", dot: "bg-violet-500", description: "Staking rewards and other income" },
    Expense: { label: "Expense", dot: "bg-rose-500", description: "Slashing penalties and other expenses" },
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <label className="flex items-center gap-2 text-[12px] font-mono text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors duration-150">
          <input
            type="checkbox"
            checked={groupByCategory}
            onChange={(e) => setGroupByCategory(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:ring-offset-0"
          />
          <span>Group by category</span>
        </label>
        {platformMode === "assisted" && (
          <Tooltip content="Some events may require manual review.">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-600 uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Assisted
            </div>
          </Tooltip>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-0)]">
        {groupByCategory ? (
          <div>
            {(["Trading", "Income", "Expense"] as EventCategory[]).map((category) => {
              const categoryItems = grouped[category];
              if (categoryItems.length === 0) return null;

              const categoryInfo = categoryLabels[category];
              let displayIndexOffset = 0;
              if (category === "Trading") {
                displayIndexOffset = 0;
              } else if (category === "Income") {
                displayIndexOffset = grouped.Trading.length;
              } else {
                displayIndexOffset = grouped.Trading.length + grouped.Income.length;
              }

              return (
                <div key={category}>
                  <div className="px-5 py-3 bg-[var(--surface-1)] border-b border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${categoryInfo.dot}`} />
                      <div>
                        <div className="text-[12px] font-semibold text-[var(--text-primary)]">{categoryInfo.label}</div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{categoryInfo.description}</div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)] ml-auto">{categoryItems.length}</span>
                    </div>
                  </div>
                  {renderTable(categoryItems, displayIndexOffset)}
                </div>
              );
            })}
          </div>
        ) : (
          renderTable(sorted, 0)
        )}
      </div>
    </div>
  );
}
