import { PerpsAdapter } from "../core/types";
import { hyperliquidAdapter } from "./hyperliquid";
import { dydxAdapter } from "./dydx";
import { gmxAdapter } from "./gmx";
import { aevoAdapter } from "./aevo";
import { kwentaAdapter } from "./kwenta";
import { jupiterAdapter } from "./jupiter";
import { driftAdapter } from "./drift";
import { vertexAdapter } from "./vertex";
import { muxAdapter } from "./mux";
import { osmosisAdapter } from "./osmosis";
import { synthetixAdapter } from "./synthetix";
import { perennialAdapter } from "./perennial";

// Substrate staking (Strict Mode)
import {
  polkadotStakingAdapter,
  kusamaStakingAdapter,
  westendStakingAdapter,
  rococoStakingAdapter,
  statemintStakingAdapter,
  statemineStakingAdapter,
  bittensorStakingAdapter,
  hydradxStakingAdapter,
  astarStakingAdapter,
  shidenStakingAdapter,
  moonbeamStakingAdapter,
  moonriverStakingAdapter,
} from "./substrate-staking";

// Cosmos SDK staking (Strict Mode)
import {
  cosmosHubStakingAdapter,
  osmosisStakingAdapter,
  neutronStakingAdapter,
  junoStakingAdapter,
  strideStakingAdapter,
  akashStakingAdapter,
  secretStakingAdapter,
} from "./cosmos-staking";

// CosmWasm perps — Levana (Assisted Mode)
import {
  levanaOsmosisAdapter,
  levanaInjectiveAdapter,
  levanaNeutronAdapter,
  levanaJunoAdapter,
} from "./levana";

// CosmWasm perps — Mars (Stub)
import { marsOsmosisAdapter, marsNeutronAdapter } from "./mars";

// Tezos staking (Strict Mode)
import { tezosStakingAdapter } from "./tezos-staking";

// Cardano staking (Strict Mode, Partial Support)
import { cardanoStakingAdapter } from "./cardano-staking";

// NEAR Protocol staking (Strict Mode)
import { nearStakingAdapter } from "./near-staking";

// Ethereum Validator rewards (Partial Mode — CL only)
import { ethValidatorAdapter } from "./eth-validators";

/**
 * Central registry of all platform adapters.
 *
 * To add a new adapter:
 * 1. Create src/lib/adapters/{platform}.ts implementing PerpsAdapter
 * 2. Import and add to the adapters array below
 * 3. Add to PLATFORMS in src/app/page.tsx with ready: true/false
 */
const adapters: PerpsAdapter[] = [
  // Fully implemented — wallet address only
  hyperliquidAdapter,
  dydxAdapter,
  gmxAdapter,

  // Fully implemented — requires API key
  aevoAdapter,

  // Close-only mode — subgraph, no opens or funding
  kwentaAdapter,

  // Stubbed — missing required data from platform APIs
  jupiterAdapter,
  driftAdapter,
  vertexAdapter,
  muxAdapter,
  osmosisAdapter,
  synthetixAdapter,
  perennialAdapter,

  // Substrate staking (Strict Mode)
  polkadotStakingAdapter,
  kusamaStakingAdapter,
  westendStakingAdapter,
  rococoStakingAdapter,
  statemintStakingAdapter,
  statemineStakingAdapter,
  bittensorStakingAdapter,
  hydradxStakingAdapter,
  astarStakingAdapter,
  shidenStakingAdapter,
  moonbeamStakingAdapter,
  moonriverStakingAdapter,

  // Cosmos SDK staking (Strict Mode)
  cosmosHubStakingAdapter,
  osmosisStakingAdapter,
  neutronStakingAdapter,
  junoStakingAdapter,
  strideStakingAdapter,
  akashStakingAdapter,
  secretStakingAdapter,

  // CosmWasm perps — Levana (Assisted Mode)
  levanaOsmosisAdapter,
  levanaInjectiveAdapter,
  levanaNeutronAdapter,
  levanaJunoAdapter,

  // CosmWasm perps — Mars (Stub)
  marsOsmosisAdapter,
  marsNeutronAdapter,

  // Tezos staking (Strict Mode)
  tezosStakingAdapter,

  // Cardano staking (Strict Mode, Partial Support — withdrawals only)
  cardanoStakingAdapter,

  // NEAR Protocol staking (Strict Mode)
  nearStakingAdapter,

  // Ethereum Validator rewards (Partial Mode — CL only)
  ethValidatorAdapter,
];

export function getAdapter(id: string): PerpsAdapter | undefined {
  return adapters.find((a) => a.id === id);
}

export function listAdapters(): { id: string; name: string }[] {
  return adapters.map((a) => ({ id: a.id, name: a.name }));
}
