import { PerpsAdapter } from "../core/types";

/**
 * Mars Protocol (Osmosis) — STUB.
 *
 * Mars credit account perps do not expose confirmed per-trade realized PnL
 * in their contract query responses. Following the project correctness rule:
 * "If the platform does not expose a value, throw an error."
 *
 * Can be promoted to full adapter when Mars API is verified to return
 * realized PnL per trade.
 */
export const marsOsmosisAdapter: PerpsAdapter = {
  id: "mars-osmosis",
  name: "Mars (Osmosis)",
  family: "cosmwasm-perps",
  supports: [],
  blocks: ["open_position", "close_position", "funding_payment", "staking_reward", "slashing"],

  async getEvents(): Promise<never> {
    throw new Error(
      "Not implemented: Mars Protocol (Osmosis) does not expose confirmed " +
      "per-trade realized PnL in contract queries. This adapter will be " +
      "enabled when the Mars API is verified to return realized PnL data."
    );
  },
};

/**
 * Mars Protocol (Neutron) — STUB.
 *
 * Same limitation as Mars (Osmosis). Realized PnL availability unconfirmed.
 */
export const marsNeutronAdapter: PerpsAdapter = {
  id: "mars-neutron",
  name: "Mars (Neutron)",
  family: "cosmwasm-perps",
  supports: [],
  blocks: ["open_position", "close_position", "funding_payment", "staking_reward", "slashing"],

  async getEvents(): Promise<never> {
    throw new Error(
      "Not implemented: Mars Protocol (Neutron) does not expose confirmed " +
      "per-trade realized PnL in contract queries. This adapter will be " +
      "enabled when the Mars API is verified to return realized PnL data."
    );
  },
};
