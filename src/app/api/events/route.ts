import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters/registry";
import { validateEvents } from "@/lib/core/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, account, apiKey, apiSecret } = body;

    if (!platform || typeof platform !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'platform' field" }, { status: 400 });
    }
    if (!account || typeof account !== "string") {
      return NextResponse.json({ error: "Missing or invalid 'account' field" }, { status: 400 });
    }

    const adapter = getAdapter(platform);
    if (!adapter) {
      return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
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
      return NextResponse.json(
        { error: `Adapter "${platform}" returned non-array result. This is a bug.` },
        { status: 500 }
      );
    }

    // Runtime assertion: every event must have required fields
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e || typeof e !== "object") {
        return NextResponse.json(
          { error: `Adapter "${platform}" returned invalid event at index ${i}.` },
          { status: 500 }
        );
      }
      if (typeof e.date !== "string" || typeof e.asset !== "string" ||
          typeof e.amount !== "number" || typeof e.fee !== "number" ||
          typeof e.pnl !== "number" || typeof e.txHash !== "string" ||
          typeof e.tag !== "string") {
        return NextResponse.json(
          { error: `Adapter "${platform}" returned malformed event at index ${i}: missing or wrong-typed fields.` },
          { status: 500 }
        );
      }
    }

    const validationErrors = validateEvents(events);

    return NextResponse.json({
      events,
      validationErrors,
      count: events.length,
      platform: adapter.name,
      mode: adapter.mode || "strict",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
