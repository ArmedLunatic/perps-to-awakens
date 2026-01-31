"use client";

import { useState, useMemo } from "react";
import { AwakensEvent } from "@/lib/core/types";

type SortKey = keyof AwakensEvent;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "date", label: "Date" },
  { key: "asset", label: "Asset" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "fee", label: "Fee", align: "right" },
  { key: "pnl", label: "P&L", align: "right" },
  { key: "paymentToken", label: "Payment Token" },
  { key: "tag", label: "Tag" },
  { key: "txHash", label: "Tx Hash" },
];

function formatNum(n: number): string {
  if (n === 0) return "0";
  const s = n.toFixed(8).replace(/\.?0+$/, "");
  return s;
}

function TagBadge({ tag }: { tag: string }) {
  const colors: Record<string, string> = {
    open_position: "bg-blue-900/50 text-blue-300 border-blue-700/50",
    close_position: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50",
    funding_payment: "bg-amber-900/50 text-amber-300 border-amber-700/50",
    staking_reward: "bg-violet-900/50 text-violet-300 border-violet-700/50",
    slashing: "bg-rose-900/50 text-rose-300 border-rose-700/50",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${colors[tag] || "bg-zinc-800 text-zinc-400"}`}>
      {tag}
    </span>
  );
}

function PnLCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-zinc-500">0</span>;
  const color = value > 0 ? "text-emerald-400" : "text-red-400";
  const prefix = value > 0 ? "+" : "";
  return <span className={color}>{prefix}{formatNum(value)}</span>;
}

export default function EventTable({ events }: { events: AwakensEvent[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [events, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="overflow-x-auto border border-zinc-800 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-3 py-2.5 font-medium cursor-pointer hover:bg-zinc-800/50 select-none whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${sortKey === col.key ? "text-zinc-100" : "text-zinc-400"}`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((event, i) => (
            <tr
              key={`${event.txHash}-${i}`}
              className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
            >
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{event.date}</td>
              <td className="px-3 py-2 font-semibold">{event.asset}</td>
              <td className="px-3 py-2 text-right font-mono">{formatNum(event.amount)}</td>
              <td className="px-3 py-2 text-right font-mono text-zinc-400">{formatNum(event.fee)}</td>
              <td className="px-3 py-2 text-right font-mono"><PnLCell value={event.pnl} /></td>
              <td className="px-3 py-2 text-zinc-400">{event.paymentToken}</td>
              <td className="px-3 py-2"><TagBadge tag={event.tag} /></td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-500 max-w-[180px] truncate" title={event.txHash}>
                {event.txHash}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
