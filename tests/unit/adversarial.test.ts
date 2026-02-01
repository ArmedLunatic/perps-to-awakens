/**
 * Adversarial tests — actively trying to break the system.
 * Run with: npx tsx tests/unit/adversarial.test.ts
 */

import { validateEvent, validateEvents } from "../../src/lib/core/validation";
import { generateCSV } from "../../src/lib/core/csv";
import { truncateDecimals } from "../../src/lib/adapters/utils";
import { AwakensEvent } from "../../src/lib/core/types";
import { getAdapter, listAdapters } from "../../src/lib/adapters/registry";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) { passed++; } else {
    failed++;
    failures.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}

// ============================================
// Adversarial: NaN / Infinity / undefined
// ============================================
console.log("\n=== Adversarial: NaN / Infinity / undefined ===");
{
  const nanEvent: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: NaN, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "adv-1", tag: "open_position",
  };
  const nanErrors = validateEvent(nanEvent, 0);
  assert(nanErrors.some(e => e.field === "amount"), "NaN amount caught");

  const infEvent: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: Infinity, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "adv-2", tag: "open_position",
  };
  const infErrors = validateEvent(infEvent, 0);
  assert(infErrors.some(e => e.field === "amount"), "Infinity amount caught");

  // NaN pnl
  const nanPnl: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: NaN,
    paymentToken: "USDC", notes: "", txHash: "adv-4", tag: "close_position",
  };
  assert(validateEvent(nanPnl, 0).some(e => e.field === "pnl"), "NaN pnl caught");

  // NaN fee
  const nanFee: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: 1, fee: NaN, pnl: 0,
    paymentToken: "", notes: "", txHash: "adv-5", tag: "open_position",
  };
  assert(validateEvent(nanFee, 0).some(e => e.field === "fee"), "NaN fee caught");

  const negInfEvent: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: -Infinity, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "adv-3", tag: "open_position",
  };
  const negInfErrors = validateEvent(negInfEvent, 0);
  assert(negInfErrors.some(e => e.field === "amount"), "negative Infinity caught");
}

// ============================================
// Adversarial: truncateDecimals edge cases
// ============================================
console.log("\n=== Adversarial: truncateDecimals ===");
{
  // truncateDecimals now throws on NaN/Infinity (correctness guard)
  let threwOnNaN = false;
  try { truncateDecimals(NaN); } catch { threwOnNaN = true; }
  assert(threwOnNaN, "truncateDecimals throws on NaN");

  let threwOnInf = false;
  try { truncateDecimals(Infinity); } catch { threwOnInf = true; }
  assert(threwOnInf, "truncateDecimals throws on Infinity");

  let threwOnNegInf = false;
  try { truncateDecimals(-Infinity); } catch { threwOnNegInf = true; }
  assert(threwOnNegInf, "truncateDecimals throws on -Infinity");

  assert(truncateDecimals(0.000000009) === 0, "9th decimal place truncated to 0");
  assert(truncateDecimals(-0.000000009) === 0, "negative 9th decimal truncated to 0");

  // MAX_SAFE_INTEGER boundary
  const bigNum = truncateDecimals(Number.MAX_SAFE_INTEGER);
  console.log(`  truncateDecimals(MAX_SAFE_INTEGER) = ${bigNum}`);
}

// ============================================
// Adversarial: CSV injection
// ============================================
console.log("\n=== Adversarial: CSV injection ===");
{
  const injectionEvent: AwakensEvent[] = [
    {
      date: "01/15/2024 12:00:00",
      asset: "ETH",
      amount: 1,
      fee: 0,
      pnl: 0,
      paymentToken: "",
      notes: '=CMD("calc")',
      txHash: "csv-inject-1",
      tag: "open_position",
    },
  ];
  const csv = generateCSV(injectionEvent);
  // The notes field should be CSV-escaped (wrapped in quotes)
  assert(csv.includes('"=CMD(""calc"")"'), `CSV injection escaped: ${csv.split("\n")[1]}`);
}

// ============================================
// Adversarial: Very long strings
// ============================================
console.log("\n=== Adversarial: Very long strings ===");
{
  const longAsset = "A".repeat(10000);
  const longEvent: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: longAsset,
    amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "long-1", tag: "open_position",
  };
  const longErrors = validateEvent(longEvent, 0);
  assert(longErrors.length === 0, "very long asset name passes (no max length rule)");
}

// ============================================
// Adversarial: Empty events array
// ============================================
console.log("\n=== Adversarial: Empty array ===");
{
  const emptyErrors = validateEvents([]);
  assert(emptyErrors.length === 0, "empty events array produces no errors");

  const emptyCSV = generateCSV([]);
  assert(emptyCSV.split("\n").length === 1, "empty CSV is header only");
}

// ============================================
// Adversarial: All adapters have unique IDs
// ============================================
console.log("\n=== Adversarial: Adapter ID uniqueness ===");
{
  const adapters = listAdapters();
  const ids = new Set<string>();
  let duplicates = 0;
  for (const a of adapters) {
    if (ids.has(a.id)) {
      console.error(`  ✗ Duplicate adapter ID: ${a.id}`);
      duplicates++;
    }
    ids.add(a.id);
  }
  assert(duplicates === 0, `no duplicate adapter IDs (found ${duplicates})`);
  console.log(`  Total adapters: ${adapters.length}, unique IDs: ${ids.size}`);
}

// ============================================
// Adversarial: date sort comparison
// ============================================
console.log("\n=== Adversarial: MM/DD/YYYY sort comparison ===");
{
  // The Hyperliquid adapter sorts using new Date(a.date) on MM/DD/YYYY format.
  // Verify this produces correct ordering
  const d1 = new Date("01/15/2024 12:00:00");
  const d2 = new Date("02/01/2024 12:00:00");
  assert(!isNaN(d1.getTime()), "MM/DD/YYYY parseable by Date constructor");
  assert(d1.getTime() < d2.getTime(), "MM/DD/YYYY dates sort correctly");

  // Year rollover
  const d3 = new Date("12/31/2023 23:59:59");
  const d4 = new Date("01/01/2024 00:00:00");
  assert(d3.getTime() < d4.getTime(), "year rollover sorts correctly");
}

// ============================================
// SUMMARY
// ============================================
console.log("\n" + "=".repeat(60));
console.log(`ADVERSARIAL TEST RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) {
    console.log(`  ${f}`);
  }
}
console.log("=".repeat(60));

process.exit(failed > 0 ? 1 : 0);
