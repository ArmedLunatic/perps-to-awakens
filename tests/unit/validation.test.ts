/**
 * Exhaustive unit tests for validation, CSV generation, and adapter utilities.
 * Run with: npx tsx tests/unit/validation.test.ts
 */

import { validateEvent, validateEvents } from "../../src/lib/core/validation";
import { generateCSV, validateCSVHeader, CSV_HEADER } from "../../src/lib/core/csv";
import { formatDateUTC, formatISODateUTC, truncateDecimals, parseAndTruncate } from "../../src/lib/adapters/utils";
import { AwakensEvent } from "../../src/lib/core/types";
import { getAdapter, listAdapters } from "../../src/lib/adapters/registry";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL: ${message}`);
    console.error(`  ✗ ${message}`);
  }
}

function assertThrows(fn: () => void, message: string) {
  try {
    fn();
    failed++;
    failures.push(`FAIL: ${message} — expected throw but none occurred`);
    console.error(`  ✗ ${message} — expected throw but none occurred`);
  } catch {
    passed++;
  }
}

async function assertAsyncThrows(fn: () => Promise<unknown>, message: string, expectedSubstring?: string) {
  try {
    await fn();
    failed++;
    failures.push(`FAIL: ${message} — expected throw but none occurred`);
    console.error(`  ✗ ${message} — expected throw but none occurred`);
  } catch (err: unknown) {
    if (expectedSubstring && err instanceof Error) {
      if (!err.message.toLowerCase().includes(expectedSubstring.toLowerCase())) {
        failed++;
        failures.push(`FAIL: ${message} — error "${err.message}" does not include "${expectedSubstring}"`);
        console.error(`  ✗ ${message} — wrong error message`);
        return;
      }
    }
    passed++;
  }
}

// ============================================
// TEST: formatDateUTC
// ============================================
console.log("\n=== formatDateUTC ===");
{
  // Known timestamp: 2024-01-15 12:30:45 UTC = 1705321845000
  const d = formatDateUTC(1705321845000);
  assert(d === "01/15/2024 12:30:45", `formatDateUTC standard: got "${d}"`);

  // Epoch
  const epoch = formatDateUTC(0);
  assert(epoch === "01/01/1970 00:00:00", `formatDateUTC epoch: got "${epoch}"`);

  // Midnight boundary
  const midnight = formatDateUTC(1704067200000); // 2024-01-01 00:00:00 UTC
  assert(midnight === "01/01/2024 00:00:00", `formatDateUTC midnight: got "${midnight}"`);

  // End of day
  const endOfDay = formatDateUTC(1704153599000); // 2024-01-01 23:59:59 UTC
  assert(endOfDay === "01/01/2024 23:59:59", `formatDateUTC end of day: got "${endOfDay}"`);
}

// ============================================
// TEST: formatISODateUTC
// ============================================
console.log("\n=== formatISODateUTC ===");
{
  const d = formatISODateUTC("2024-01-15T12:30:45.000Z");
  assert(d === "01/15/2024 12:30:45", `formatISODateUTC standard: got "${d}"`);

  assertThrows(() => formatISODateUTC("not-a-date"), "formatISODateUTC invalid input");
  assertThrows(() => formatISODateUTC(""), "formatISODateUTC empty string");
}

// ============================================
// TEST: truncateDecimals
// ============================================
console.log("\n=== truncateDecimals ===");
{
  assert(truncateDecimals(1.123456789) === 1.12345678, `truncateDecimals 9 places: got ${truncateDecimals(1.123456789)}`);
  assert(truncateDecimals(0) === 0, "truncateDecimals zero");
  assert(truncateDecimals(-1.123456789) === -1.12345678, `truncateDecimals negative: got ${truncateDecimals(-1.123456789)}`);
  assert(truncateDecimals(1.12345678) === 1.12345678, "truncateDecimals exactly 8 places");
  assert(truncateDecimals(100) === 100, "truncateDecimals integer");
  assert(truncateDecimals(0.000000001) === 0, "truncateDecimals below precision");

  // CRITICAL: Truncation, not rounding
  assert(truncateDecimals(1.999999999) === 1.99999999, `truncateDecimals truncates not rounds: got ${truncateDecimals(1.999999999)}`);
}

// ============================================
// TEST: parseAndTruncate
// ============================================
console.log("\n=== parseAndTruncate ===");
{
  assert(parseAndTruncate("1.123456789", "test") === 1.12345678, "parseAndTruncate valid");
  assert(parseAndTruncate("0", "test") === 0, "parseAndTruncate zero");
  assert(parseAndTruncate("-5.5", "test") === -5.5, "parseAndTruncate negative");
  assertThrows(() => parseAndTruncate("abc", "test"), "parseAndTruncate NaN");
  assertThrows(() => parseAndTruncate("", "test"), "parseAndTruncate empty");
}

// ============================================
// TEST: validateEvent — valid events
// ============================================
console.log("\n=== validateEvent — valid events ===");
{
  const validOpen: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH",
    amount: 1.5,
    fee: 0.001,
    pnl: 0,
    paymentToken: "",
    notes: "Open Long @ 2500",
    txHash: "0xabc123-1",
    tag: "open_position",
  };
  const errors = validateEvent(validOpen, 0);
  assert(errors.length === 0, `valid open_position: ${errors.length} errors: ${JSON.stringify(errors)}`);

  const validClose: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH",
    amount: 1.5,
    fee: 0.001,
    pnl: 50.25,
    paymentToken: "USDC",
    notes: "Close Long",
    txHash: "0xabc123-2",
    tag: "close_position",
  };
  assert(validateEvent(validClose, 0).length === 0, "valid close_position");

  const validFunding: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "USDC",
    amount: 1.5,
    fee: 0,
    pnl: -1.5,
    paymentToken: "USDC",
    notes: "Funding",
    txHash: "funding-1",
    tag: "funding_payment",
  };
  assert(validateEvent(validFunding, 0).length === 0, "valid funding_payment");

  const validReward: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT",
    amount: 10,
    fee: 0,
    pnl: 10,
    paymentToken: "DOT",
    notes: "Staking reward",
    txHash: "reward-1",
    tag: "staking_reward",
  };
  assert(validateEvent(validReward, 0).length === 0, "valid staking_reward");

  const validSlash: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT",
    amount: 5,
    fee: 0,
    pnl: -5,
    paymentToken: "DOT",
    notes: "Slash",
    txHash: "slash-1",
    tag: "slashing",
  };
  assert(validateEvent(validSlash, 0).length === 0, "valid slashing");
}

// ============================================
// TEST: validateEvent — invalid events
// ============================================
console.log("\n=== validateEvent — invalid events ===");
{
  // Bad date format
  const badDate: AwakensEvent = {
    date: "2024-01-15 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx1", tag: "open_position",
  };
  const dateErrors = validateEvent(badDate, 0);
  assert(dateErrors.some(e => e.field === "date"), "bad date format caught");

  // Invalid month
  const badMonth: AwakensEvent = {
    date: "13/15/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx2", tag: "open_position",
  };
  assert(validateEvent(badMonth, 0).some(e => e.field === "date"), "invalid month caught");

  // Invalid day
  const badDay: AwakensEvent = {
    date: "01/32/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx3", tag: "open_position",
  };
  assert(validateEvent(badDay, 0).some(e => e.field === "date"), "invalid day caught");

  // Year out of range
  const badYear: AwakensEvent = {
    date: "01/15/1999 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx4", tag: "open_position",
  };
  assert(validateEvent(badYear, 0).some(e => e.field === "date"), "year < 2000 caught");

  // Empty asset
  const emptyAsset: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx5", tag: "open_position",
  };
  assert(validateEvent(emptyAsset, 0).some(e => e.field === "asset"), "empty asset caught");

  // Empty txHash
  const emptyTx: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "", tag: "open_position",
  };
  assert(validateEvent(emptyTx, 0).some(e => e.field === "txHash"), "empty txHash caught");

  // Invalid tag
  const badTag: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx6", tag: "invalid_tag" as any,
  };
  assert(validateEvent(badTag, 0).some(e => e.field === "tag"), "invalid tag caught");

  // open_position with non-zero pnl
  const openWithPnl: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 50,
    paymentToken: "", notes: "", txHash: "tx7", tag: "open_position",
  };
  assert(validateEvent(openWithPnl, 0).some(e => e.field === "pnl"), "open_position pnl!=0 caught");

  // staking_reward with pnl <= 0
  const rewardNoPnl: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT", amount: 10, fee: 0, pnl: 0,
    paymentToken: "DOT", notes: "", txHash: "tx8", tag: "staking_reward",
  };
  assert(validateEvent(rewardNoPnl, 0).some(e => e.field === "pnl"), "staking_reward pnl=0 caught");

  // staking_reward with fee != 0
  const rewardWithFee: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT", amount: 10, fee: 0.5, pnl: 10,
    paymentToken: "DOT", notes: "", txHash: "tx9", tag: "staking_reward",
  };
  assert(validateEvent(rewardWithFee, 0).some(e => e.field === "fee"), "staking_reward fee!=0 caught");

  // slashing with pnl >= 0
  const slashPosPnl: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT", amount: 5, fee: 0, pnl: 5,
    paymentToken: "DOT", notes: "", txHash: "tx10", tag: "slashing",
  };
  assert(validateEvent(slashPosPnl, 0).some(e => e.field === "pnl"), "slashing pnl>0 caught");

  // slashing with fee != 0
  const slashWithFee: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "DOT", amount: 5, fee: 1, pnl: -5,
    paymentToken: "DOT", notes: "", txHash: "tx11", tag: "slashing",
  };
  assert(validateEvent(slashWithFee, 0).some(e => e.field === "fee"), "slashing fee!=0 caught");

  // close_position without paymentToken
  const closeNoToken: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH", amount: 1, fee: 0, pnl: 50,
    paymentToken: "", notes: "", txHash: "tx12", tag: "close_position",
  };
  assert(validateEvent(closeNoToken, 0).some(e => e.field === "paymentToken"), "close without paymentToken caught");

  // funding_payment without paymentToken
  const fundingNoToken: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "USDC", amount: 1, fee: 0, pnl: -1,
    paymentToken: "", notes: "", txHash: "tx13", tag: "funding_payment",
  };
  assert(validateEvent(fundingNoToken, 0).some(e => e.field === "paymentToken"), "funding without paymentToken caught");

  // Excessive decimals
  const tooManyDecimals: AwakensEvent = {
    date: "01/15/2024 12:30:45",
    asset: "ETH", amount: 1.123456789, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "tx14", tag: "open_position",
  };
  assert(validateEvent(tooManyDecimals, 0).some(e => e.field === "amount"), "excessive decimals caught");
}

// ============================================
// TEST: validateEvents — duplicate txHash
// ============================================
console.log("\n=== validateEvents — duplicates ===");
{
  const events: AwakensEvent[] = [
    {
      date: "01/15/2024 12:30:45", asset: "ETH", amount: 1, fee: 0, pnl: 0,
      paymentToken: "", notes: "", txHash: "duplicate-hash", tag: "open_position",
    },
    {
      date: "01/15/2024 12:31:45", asset: "ETH", amount: 1, fee: 0, pnl: 0,
      paymentToken: "", notes: "", txHash: "duplicate-hash", tag: "open_position",
    },
  ];
  const errors = validateEvents(events);
  assert(errors.some(e => e.message.includes("Duplicate")), "duplicate txHash caught");
}

// ============================================
// TEST: CSV generation
// ============================================
console.log("\n=== CSV generation ===");
{
  const validEvents: AwakensEvent[] = [
    {
      date: "01/15/2024 12:30:45", asset: "ETH", amount: 1.5, fee: 0.001,
      pnl: 0, paymentToken: "", notes: "Open Long", txHash: "tx-1",
      tag: "open_position",
    },
    {
      date: "01/15/2024 13:30:45", asset: "ETH", amount: 1.5, fee: 0.001,
      pnl: 50.25, paymentToken: "USDC", notes: "Close Long", txHash: "tx-2",
      tag: "close_position",
    },
  ];

  const csv = generateCSV(validEvents);
  const lines = csv.split("\n");
  assert(lines[0] === CSV_HEADER, "CSV header matches");
  assert(lines.length === 3, `CSV has correct line count: ${lines.length}`);
  assert(lines[1].includes("ETH"), "CSV row contains asset");
  assert(lines[1].includes("open_position"), "CSV row contains tag");

  // CSV with validation errors should throw
  const badEvents: AwakensEvent[] = [
    {
      date: "INVALID", asset: "", amount: 1, fee: 0, pnl: 0,
      paymentToken: "", notes: "", txHash: "", tag: "open_position",
    },
  ];
  assertThrows(() => generateCSV(badEvents), "CSV generation throws on invalid events");
}

// ============================================
// TEST: CSV header validation
// ============================================
console.log("\n=== CSV header validation ===");
{
  assert(validateCSVHeader(CSV_HEADER) === true, "valid header accepted");
  assert(validateCSVHeader("Wrong,Header") === false, "invalid header rejected");
  assert(validateCSVHeader(`  ${CSV_HEADER}  `) === true, "trimmed header accepted");
}

// ============================================
// TEST: CSV escaping
// ============================================
console.log("\n=== CSV escaping ===");
{
  const eventWithComma: AwakensEvent[] = [
    {
      date: "01/15/2024 12:30:45", asset: "ETH", amount: 1, fee: 0,
      pnl: 0, paymentToken: "", notes: "Hello, world", txHash: "tx-esc-1",
      tag: "open_position",
    },
  ];
  const csv = generateCSV(eventWithComma);
  assert(csv.includes('"Hello, world"'), `CSV escapes commas in notes: ${csv}`);
}

// ============================================
// TEST: Registry
// ============================================
console.log("\n=== Registry ===");
{
  const adapters = listAdapters();
  assert(adapters.length > 0, `Registry has adapters: ${adapters.length}`);

  // Check key adapters exist
  assert(getAdapter("hyperliquid") !== undefined, "hyperliquid adapter exists");
  assert(getAdapter("dydx") !== undefined, "dydx adapter exists");
  assert(getAdapter("gmx") !== undefined, "gmx adapter exists");
  assert(getAdapter("aevo") !== undefined, "aevo adapter exists");
  assert(getAdapter("kwenta") !== undefined, "kwenta adapter exists");

  // Stubs exist
  assert(getAdapter("jupiter") !== undefined, "jupiter stub exists");
  assert(getAdapter("drift") !== undefined, "drift stub exists");

  // Staking adapters
  assert(getAdapter("polkadot-staking") !== undefined, "polkadot-staking exists");
  assert(getAdapter("cosmos-hub-staking") !== undefined, "cosmos-hub-staking exists");

  // Unknown adapter
  assert(getAdapter("nonexistent") === undefined, "unknown adapter returns undefined");
}

// ============================================
// TEST: Stub adapters throw correctly
// ============================================
async function testStubs() {
  console.log("\n=== Stub adapter rejection ===");
  const stubs = ["jupiter", "drift", "vertex", "mux", "osmosis", "synthetix", "perennial"];
  for (const stubId of stubs) {
    const adapter = getAdapter(stubId);
    if (adapter) {
      await assertAsyncThrows(
        () => adapter.getEvents("0x0000000000000000000000000000000000000001"),
        `${stubId} stub throws on getEvents`,
        "not implemented"
      );
    } else {
      console.log(`  ? ${stubId} — not found in registry (may have different ID)`);
    }
  }
}

// ============================================
// TEST: Adapter input validation
// ============================================
async function testAdapterInputValidation() {
  console.log("\n=== Adapter input validation ===");
  const hl = getAdapter("hyperliquid")!;
  await assertAsyncThrows(
    () => hl.getEvents(""),
    "hyperliquid rejects empty account"
  );
  await assertAsyncThrows(
    () => hl.getEvents("not-an-address"),
    "hyperliquid rejects invalid address"
  );
  await assertAsyncThrows(
    () => hl.getEvents("0x123"),
    "hyperliquid rejects short address"
  );

  const dydx = getAdapter("dydx")!;
  await assertAsyncThrows(
    () => dydx.getEvents("0x0000000000000000000000000000000000000001"),
    "dydx rejects non-bech32 address"
  );
  await assertAsyncThrows(
    () => dydx.getEvents(""),
    "dydx rejects empty address"
  );

  const gmx = getAdapter("gmx")!;
  await assertAsyncThrows(
    () => gmx.getEvents("not-valid"),
    "gmx rejects invalid address"
  );

  const aevo = getAdapter("aevo")!;
  await assertAsyncThrows(
    () => aevo.getEvents("0x0000000000000000000000000000000000000001"),
    "aevo rejects missing API keys",
    "API key"
  );
  await assertAsyncThrows(
    () => aevo.getEvents("not-valid", { apiKey: "k", apiSecret: "s" }),
    "aevo rejects invalid address"
  );

  const kwenta = getAdapter("kwenta")!;
  await assertAsyncThrows(
    () => kwenta.getEvents("not-valid"),
    "kwenta rejects invalid address"
  );
}

// ============================================
// TEST: Adapter metadata
// ============================================
console.log("\n=== Adapter metadata ===");
{
  const hl = getAdapter("hyperliquid")!;
  assert(hl.id === "hyperliquid", "hyperliquid id correct");
  assert(hl.name === "Hyperliquid", "hyperliquid name correct");

  const polkadot = getAdapter("polkadot-staking")!;
  assert(polkadot.mode === "strict", "polkadot mode is strict");
  assert(polkadot.family === "substrate-staking", "polkadot family correct");
  assert(polkadot.supports?.includes("staking_reward") === true, "polkadot supports staking_reward");
  assert(polkadot.blocks?.includes("open_position") === true, "polkadot blocks open_position");

  const cosmos = getAdapter("cosmos-hub-staking")!;
  assert(cosmos.mode === "strict", "cosmos-hub mode is strict");
  assert(cosmos.family === "cosmos-staking", "cosmos-hub family correct");
}

// ============================================
// TEST: Date edge cases in validation
// ============================================
console.log("\n=== Date edge cases ===");
{
  // Feb 30 — now correctly caught by calendar-aware validation
  const feb30: AwakensEvent = {
    date: "02/30/2024 12:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-1", tag: "open_position",
  };
  const feb30Errors = validateEvent(feb30, 0);
  assert(feb30Errors.some(e => e.field === "date"), "Feb 30 correctly rejected");

  // Feb 29 on leap year should be valid
  const feb29Leap: AwakensEvent = {
    date: "02/29/2024 12:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-1b", tag: "open_position",
  };
  assert(validateEvent(feb29Leap, 0).filter(e => e.field === "date").length === 0, "Feb 29 2024 (leap year) accepted");

  // Feb 29 on non-leap year should fail
  const feb29NonLeap: AwakensEvent = {
    date: "02/29/2023 12:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-1c", tag: "open_position",
  };
  assert(validateEvent(feb29NonLeap, 0).some(e => e.field === "date"), "Feb 29 2023 (non-leap) rejected");

  // Apr 31 should fail
  const apr31: AwakensEvent = {
    date: "04/31/2024 12:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-1d", tag: "open_position",
  };
  assert(validateEvent(apr31, 0).some(e => e.field === "date"), "Apr 31 correctly rejected");

  // Negative amount should fail
  const negAmount: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: -1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "neg-amount-1", tag: "open_position",
  };
  assert(validateEvent(negAmount, 0).some(e => e.field === "amount"), "negative amount rejected");

  // Negative fee should fail
  const negFee: AwakensEvent = {
    date: "01/15/2024 12:00:00",
    asset: "ETH", amount: 1, fee: -0.5, pnl: 0,
    paymentToken: "", notes: "", txHash: "neg-fee-1", tag: "open_position",
  };
  assert(validateEvent(negFee, 0).some(e => e.field === "fee"), "negative fee rejected");

  // Hour 24
  const hour24: AwakensEvent = {
    date: "01/15/2024 24:00:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-2", tag: "open_position",
  };
  assert(validateEvent(hour24, 0).some(e => e.field === "date"), "hour 24 caught");

  // Minute 60
  const min60: AwakensEvent = {
    date: "01/15/2024 12:60:00",
    asset: "ETH", amount: 1, fee: 0, pnl: 0,
    paymentToken: "", notes: "", txHash: "date-edge-3", tag: "open_position",
  };
  assert(validateEvent(min60, 0).some(e => e.field === "date"), "minute 60 caught");
}

// ============================================
// TEST: Number formatting edge cases
// ============================================
console.log("\n=== Number formatting edge cases ===");
{
  // Test that truncation works correctly for edge case: 0.000000005 should truncate to 0
  const tiny = truncateDecimals(0.000000005);
  assert(tiny === 0, `tiny number truncates to 0: got ${tiny}`);

  // Scientific notation handling
  const sci = truncateDecimals(1e-9);
  assert(sci === 0, `scientific notation 1e-9 truncates to 0: got ${sci}`);

  // Large number
  const large = truncateDecimals(999999999.123456789);
  assert(large === 999999999.12345678, `large number truncated: got ${large}`);
}

// ============================================
// RUN ASYNC TESTS + SUMMARY
// ============================================
async function runAsyncTests() {
  await testStubs();
  await testAdapterInputValidation();

  console.log("\n" + "=".repeat(60));
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failures) {
      console.log(`  ${f}`);
    }
  }
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runAsyncTests();
