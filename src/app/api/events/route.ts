import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters/registry";
import { validateEvents } from "@/lib/core/validation";
import { ClassifiedError } from "@/lib/core/types";

/**
 * Classify an error message into a structured error with recovery guidance.
 */
function classifyError(message: string, platform: string): ClassifiedError {
  const lower = message.toLowerCase();

  // Network connectivity failures
  if (lower.includes("network error") || lower.includes("could not reach") ||
      lower.includes("econnrefused") || lower.includes("enotfound") ||
      lower.includes("etimedout") || lower.includes("fetch failed")) {
    return {
      type: "network",
      reason: message,
      userAction: "Check your internet connection and retry.",
      blockedByDesign: false,
    };
  }

  // Rate limiting
  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many")) {
    return {
      type: "rate-limit",
      reason: message,
      userAction: "Wait a few minutes, then retry.",
      blockedByDesign: false,
    };
  }

  // Authentication failures
  if (lower.includes("authentication failed") || lower.includes("api key") ||
      lower.includes("api secret") || lower.includes("401") || lower.includes("403")) {
    return {
      type: "auth",
      reason: message,
      userAction: "Check your API key and secret, then retry.",
      blockedByDesign: false,
    };
  }

  // Address format / input validation
  if (lower.includes("invalid") && (lower.includes("address") || lower.includes("account") ||
      lower.includes("format") || lower.includes("expected"))) {
    return {
      type: "validation",
      reason: message,
      userAction: "Check the address format and correct it.",
      blockedByDesign: false,
    };
  }

  // Adapter not implemented / blocked by design
  if (lower.includes("not implemented") || lower.includes("blocked") ||
      lower.includes("violate") || lower.includes("correctness requirements")) {
    return {
      type: "blocked-by-design",
      reason: message,
      blockedByDesign: true,
    };
  }

  // Fallback: internal / unknown
  return {
    type: "internal",
    reason: message,
    userAction: "Try again. If the issue persists, the platform API may be temporarily unavailable.",
    blockedByDesign: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, account, apiKey, apiSecret } = body;

    if (!platform || typeof platform !== "string") {
      return NextResponse.json({
        error: "Missing or invalid 'platform' field",
        classified: { type: "validation", reason: "Missing or invalid 'platform' field", userAction: "Select a platform and try again.", blockedByDesign: false },
      }, { status: 400 });
    }
    if (!account || typeof account !== "string") {
      return NextResponse.json({
        error: "Missing or invalid 'account' field",
        classified: { type: "validation", reason: "Missing or invalid 'account' field", userAction: "Enter a valid account address.", blockedByDesign: false },
      }, { status: 400 });
    }

    const adapter = getAdapter(platform);
    if (!adapter) {
      return NextResponse.json({
        error: `Unknown platform: ${platform}`,
        classified: { type: "validation", reason: `Unknown platform: ${platform}`, userAction: "Select a supported platform.", blockedByDesign: false },
      }, { status: 400 });
    }

    // Build options for adapters that require authentication
    const options =
      apiKey || apiSecret
        ? {
            apiKey: typeof apiKey === "string" ? apiKey : undefined,
            apiSecret: typeof apiSecret === "string" ? apiSecret : undefined,
          }
        : undefined;

    const events = await adapter.getEvents(account.trim(), options);

    // Runtime assertion: adapter must return an array
    if (!Array.isArray(events)) {
      return NextResponse.json({
        error: `Adapter "${platform}" returned non-array result. This is a bug.`,
        classified: { type: "internal", reason: "Adapter returned non-array result.", blockedByDesign: false },
      }, { status: 500 });
    }

    // Runtime assertion: every event must have required fields
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e || typeof e !== "object") {
        return NextResponse.json({
          error: `Adapter "${platform}" returned invalid event at index ${i}.`,
          classified: { type: "internal", reason: `Malformed event at index ${i}.`, blockedByDesign: false },
        }, { status: 500 });
      }
      if (typeof e.date !== "string" || typeof e.asset !== "string" ||
          typeof e.amount !== "number" || typeof e.fee !== "number" ||
          typeof e.pnl !== "number" || typeof e.txHash !== "string" ||
          typeof e.tag !== "string") {
        return NextResponse.json({
          error: `Adapter "${platform}" returned malformed event at index ${i}: missing or wrong-typed fields.`,
          classified: { type: "internal", reason: `Malformed event at index ${i}: missing or wrong-typed fields.`, blockedByDesign: false },
        }, { status: 500 });
      }
    }

    const validationErrors = validateEvents(events);

    // Detect truncation: check if any event notes contain the truncation warning
    const truncated = events.some((e) => e.notes?.includes("[WARNING: Results may be truncated"));

    return NextResponse.json({
      events,
      validationErrors,
      count: events.length,
      platform: adapter.name,
      mode: adapter.mode || "strict",
      truncated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const classified = classifyError(message, "");
    return NextResponse.json({ error: message, classified }, { status: 500 });
  }
}
