import { PerpsAdapter } from "../core/types";
import { hyperliquidAdapter } from "./hyperliquid";
import { dydxAdapter } from "./dydx";
import { gmxAdapter } from "./gmx";
import { jupiterAdapter } from "./jupiter";
import { driftAdapter } from "./drift";
import { aevoAdapter } from "./aevo";
import { vertexAdapter } from "./vertex";
import { muxAdapter } from "./mux";
import { osmosisAdapter } from "./osmosis";
import { kwentaAdapter } from "./kwenta";
import { synthetixAdapter } from "./synthetix";
import { perennialAdapter } from "./perennial";

/**
 * Central registry of all platform adapters.
 *
 * To add a new adapter:
 * 1. Create src/lib/adapters/{platform}.ts implementing PerpsAdapter
 * 2. Import and add to the adapters array below
 * 3. Add to PLATFORMS in src/app/page.tsx with ready: true/false
 */
const adapters: PerpsAdapter[] = [
  // Tier 1 — Fully implemented
  hyperliquidAdapter,
  dydxAdapter,
  gmxAdapter,

  // Tier 1 — Stubbed (missing required data from platform APIs)
  jupiterAdapter,
  driftAdapter,
  aevoAdapter,

  // Tier 2 — Stubbed (insufficient realized P&L data)
  vertexAdapter,
  muxAdapter,
  osmosisAdapter,

  // Tier 3 — Stubbed (no logic, documentation only)
  kwentaAdapter,
  synthetixAdapter,
  perennialAdapter,
];

export function getAdapter(id: string): PerpsAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

export function listAdapters(): { id: string; name: string }[] {
  return adapters.map((a) => ({ id: a.id, name: a.name }));
}
