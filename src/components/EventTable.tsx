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
  { key: "paymentToken", label: "Payment Token", tooltip: "Token used for payment" },
  { key: "tag", label: "Event Type", tooltip: "Category of accounting event" },
  { key: "txHash", label: "Transaction", tooltip: "On-chain transaction identifier" },
];

function formatNum(n: number): string {
  if (n === 0) return "0";
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s;
}

// Group events by category
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
  const config: Record<string, { bg: string; text: string; border: string; icon?: string; tooltip?: string }> = {
    open_position: {
      bg: "bg-blue-950/30",
      text: "text-blue-300",
      border: "border-blue-800/40",
      icon: "↗",
      tooltip: "Opening a new position",
    },
    close_position: {
      bg: "bg-emerald-950/30",
      text: "text-emerald-300",
      border: "border-emerald-800/40",
      icon: "↘",
      tooltip: "Closing a position",
    },
    funding_payment: {
      bg: "bg-amber-950/30",
      text: "text-amber-300",
      border: "border-amber-800/40",
      icon: "↔",
      tooltip: "Funding payment (periodic fee)",
    },
    staking_reward: {
      bg: "bg-violet-950/30",
      text: "text-violet-300",
      border: "border-violet-800/40",
      icon: "↑",
      tooltip: "Staking reward: income from validating or delegating",
    },
    slashing: {
      bg: "bg-rose-950/30",
      text: "text-rose-300",
      border: "border-rose-800/40",
      icon: "↓",
      tooltip: "Slashing: penalty for validator misbehavior",
    },
  };

  const style = config[tag] || { bg: "bg-zinc-800/50", text: "text-zinc-400", border: "border-zinc-700/50" };

  return (
    <span
      className={`group/tooltip relative inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}
    >
      {style.icon && <span className="text-[10px]">{style.icon}</span>}
      <span>{tag}</span>
      {style.tooltip && (
        <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-10 px-2 py-1 text-[10px] font-normal text-zinc-100 bg-zinc-800 border border-zinc-700 rounded whitespace-nowrap pointer-events-none shadow-lg">
          {style.tooltip}
        </span>
      )}
    </span>
  );
}

function PnLCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-zinc-500">0</span>;
  const color = value > 0 ? "text-emerald-400" : "text-red-400";
  const prefix = value > 0 ? "+" : "";
  return <span className={color}>{prefix}{formatNum(value)}</span>;
}

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <span className="group/tooltip relative inline-flex items-center">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block z-20 px-2 py-1 text-[10px] font-normal text-zinc-100 bg-zinc-800 border border-zinc-700 rounded whitespace-nowrap pointer-events-none shadow-lg">
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

  // Create error map for quick lookup
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

  // Group events by category
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800/50 bg-zinc-900/40">
            <th className="w-10 px-3"></th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 font-medium cursor-pointer hover:bg-zinc-800/40 select-none whitespace-nowrap transition-colors duration-200 ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${sortKey === col.key ? "text-zinc-100" : "text-zinc-400"}`}
              >
                <div className="flex items-center gap-1.5">
                  {col.tooltip ? (
                    <Tooltip content={col.tooltip}>
                      <span>{col.label}</span>
                    </Tooltip>
                  ) : (
                    <span>{col.label}</span>
                  )}
                  {sortKey === col.key && (
                    <span className="text-xs text-zinc-500">{sortDir === "asc" ? "▲" : "▼"}</span>
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
                  className={`border-b border-zinc-800/30 transition-all duration-200 ${
                    hasErrors
                      ? "bg-red-950/10 hover:bg-red-950/20"
                      : "hover:bg-zinc-900/30"
                  }`}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => toggleRow(displayIndex)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-600 rounded"
                      aria-label={isExpanded ? "Collapse row" : "Expand row"}
                    >
                      {isExpanded ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-zinc-400">
                    {event.date}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-100">{event.asset}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">{formatNum(event.amount)}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">{formatNum(event.fee)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    <PnLCell value={event.pnl} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{event.paymentToken}</td>
                  <td className="px-4 py-3">
                    <TagBadge tag={event.tag} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500 max-w-[200px] truncate" title={event.txHash}>
                    {event.txHash}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-zinc-900/30 border-b border-zinc-800/20">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="space-y-3 text-xs leading-relaxed">
                        {event.notes && (
                          <div className="pb-2 border-b border-zinc-800/30">
                            <div className="text-zinc-500 font-medium mb-1.5">Notes</div>
                            <div className="text-zinc-400">{event.notes}</div>
                          </div>
                        )}
                        {hasErrors && (
                          <div className="pt-2 border-t border-red-800/30">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <div className="text-red-400 font-medium">Validation errors</div>
                            </div>
                            <div className="space-y-1.5 font-mono text-red-400/90 pl-6">
                              {rowErrors.map((err, idx) => (
                                <div key={idx}>
                                  [{err.field}] {err.message}
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-red-400/70 mt-2 pl-6">
                              This event cannot be exported until these errors are resolved.
                            </div>
                          </div>
                        )}
                        {platformMode === "assisted" && !hasErrors && (
                          <div className="pt-2 border-t border-amber-800/30">
                            <div className="flex items-start gap-2">
                              <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <div className="text-amber-400 font-medium mb-1">Assisted Mode</div>
                                <div className="text-amber-300/80 leading-relaxed">
                                  This event was generated in Assisted Mode. Please review it for accuracy before export. If anything looks incorrect, you may need to manually adjust the exported data.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {!event.notes && !hasErrors && platformMode !== "assisted" && (
                          <div className="text-zinc-500 italic">
                            No additional details available for this event.
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

  const categoryLabels: Record<EventCategory, { label: string; icon: string; color: string; description: string }> = {
    Trading: { label: "Trading", icon: "↔", color: "text-blue-400", description: "Position opens, closes, and funding payments" },
    Income: { label: "Income", icon: "↑", color: "text-violet-400", description: "Staking rewards and other income" },
    Expense: { label: "Expense", icon: "↓", color: "text-rose-400", description: "Slashing penalties and other expenses" },
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors duration-200">
            <input
              type="checkbox"
              checked={groupByCategory}
              onChange={(e) => setGroupByCategory(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-950"
            />
            <span>Group by category</span>
          </label>
        </div>
        {platformMode === "assisted" && (
          <Tooltip content="Assisted Mode: Some events may require manual review. Check expanded row details for confidence indicators.">
            <div className="flex items-center gap-1.5 text-xs text-amber-400/80">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Assisted Mode Active</span>
            </div>
          </Tooltip>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-zinc-800/50 rounded-lg bg-zinc-950/40 shadow-sm">
        {groupByCategory ? (
          <div className="divide-y divide-zinc-800/50">
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
                  <div className="px-5 py-3 bg-zinc-900/50 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm font-medium ${categoryInfo.color}`}>
                        {categoryInfo.icon}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-zinc-300">{categoryInfo.label}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{categoryInfo.description}</div>
                      </div>
                      <span className="text-xs text-zinc-500 ml-auto">({categoryItems.length})</span>
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
