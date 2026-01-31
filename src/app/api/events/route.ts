import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters/registry";
import { validateEvents } from "@/lib/core/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, account } = body;

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

    const events = await adapter.getEvents(account.trim());
    const validationErrors = validateEvents(events);

    return NextResponse.json({
      events,
      validationErrors,
      count: events.length,
      platform: adapter.name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
