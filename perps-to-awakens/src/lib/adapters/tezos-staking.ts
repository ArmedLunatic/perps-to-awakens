import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Tezos Staking Adapter (STRICT MODE)
 *
 * Supported:
 *   - Baking rewards (explicit protocol events)
 *   - Delegation rewards (explicit protocol events)
 *   - Slashing / denounciation penalties
 *
 * Blocked:
 *   - DeFi activity (no inference)
 *   - Token transfers (not accounting events)
 *   - Balance-based reward inference
 *   - Liquidity baking subsidies (protocol subsidy, not staking)
 *
 * Data source: TzKT API (https://api.tzkt.io)
 * The TzKT API provides explicit reward and penalty events
 * emitted by the Tezos protocol. No inference required.
 */

type TzktRewardItem = {
  id: number;
  level: number;
  timestamp: string;
  baker: { address: string };
  delegator?: { address: string };
  amount: number; // mutez (1 XTZ = 1,000,000 mutez)
  type: string;
};

type TzktSlashingItem = {
  id: number;
  level: number;
  timestamp: string;
  offender: { address: string };
  lostStaking: number;
  lostExternalStaking: number;
  lostExternalUnstaking: number;
};

function formatDate(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function mutezToXTZ(mutez: number): number {
  const value = mutez / 1_000_000;
  return parseFloat(value.toFixed(8));
}

export const tezosStakingAdapter: PerpsAdapter = {
  id: "tezos-staking",
  name: "Tezos Staking",
  mode: "strict",
  family: "tezos-staking",
  supports: ["staking_reward", "slashing"],
  blocks: ["open_position", "close_position", "funding_payment"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Tezos address format (tz1, tz2, tz3 for implicit, KT1 for originated)
    if (!/^(tz[123]|KT1)[a-zA-Z0-9]{33}$/.test(account)) {
      throw new Error(
        `Invalid Tezos address format. Expected tz1/tz2/tz3/KT1 followed by 33 alphanumeric characters, got "${account}"`
      );
    }

    const events: AwakensEvent[] = [];
    const API_BASE = "https://api.tzkt.io/v1";

    // Fetch staking rewards (baking + endorsing + delegation rewards)
    // TzKT exposes these as explicit protocol-level reward events
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${API_BASE}/rewards/delegators/${account}?offset=${offset}&limit=${limit}&sort.desc=cycle`;

      const res = await fetch(url);
      if (!res.ok) {
        // Fall back to baker rewards if delegator endpoint fails
        if (res.status === 404) break;
        throw new Error(`TzKT API error: HTTP ${res.status}`);
      }

      const rewards: TzktRewardItem[] = await res.json();

      if (!Array.isArray(rewards) || rewards.length === 0) {
        hasMore = false;
        break;
      }

      for (const reward of rewards) {
        const amount = mutezToXTZ(reward.amount);
        if (amount <= 0) continue;

        events.push({
          date: formatDate(reward.timestamp),
          asset: "XTZ",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "XTZ",
          notes: `Tezos ${reward.type || "delegation"} reward at level ${reward.level}`,
          txHash: `tezos-reward-${reward.id}`,
          tag: "staking_reward",
        });
      }

      if (rewards.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    // Also fetch baker rewards if the account is a baker
    offset = 0;
    hasMore = true;

    while (hasMore) {
      const url = `${API_BASE}/rewards/bakers/${account}?offset=${offset}&limit=${limit}&sort.desc=cycle`;

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) break; // Not a baker, skip
        throw new Error(`TzKT API error for baker rewards: HTTP ${res.status}`);
      }

      const rewards: TzktRewardItem[] = await res.json();

      if (!Array.isArray(rewards) || rewards.length === 0) {
        hasMore = false;
        break;
      }

      for (const reward of rewards) {
        const amount = mutezToXTZ(reward.amount);
        if (amount <= 0) continue;

        events.push({
          date: formatDate(reward.timestamp),
          asset: "XTZ",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "XTZ",
          notes: `Tezos baking reward at level ${reward.level}`,
          txHash: `tezos-baking-${reward.id}`,
          tag: "staking_reward",
        });
      }

      if (rewards.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    // Fetch slashing events (double-baking / double-endorsing denounciations)
    try {
      const slashUrl = `${API_BASE}/operations/double_baking?offender=${account}&limit=${limit}`;
      const slashRes = await fetch(slashUrl);

      if (slashRes.ok) {
        const slashEvents: TzktSlashingItem[] = await slashRes.json();

        for (const slash of slashEvents) {
          const totalLost = slash.lostStaking + slash.lostExternalStaking + slash.lostExternalUnstaking;
          const amount = mutezToXTZ(totalLost);
          if (amount <= 0) continue;

          events.push({
            date: formatDate(new Date(slash.level).toISOString()),
            asset: "XTZ",
            amount,
            fee: 0,
            pnl: -amount,
            paymentToken: "XTZ",
            notes: `Tezos double-baking slash at level ${slash.level}`,
            txHash: `tezos-slash-db-${slash.id}`,
            tag: "slashing",
          });
        }
      }

      // Double-endorsing
      const deSlashUrl = `${API_BASE}/operations/double_endorsing?offender=${account}&limit=${limit}`;
      const deSlashRes = await fetch(deSlashUrl);

      if (deSlashRes.ok) {
        const deSlashEvents: TzktSlashingItem[] = await deSlashRes.json();

        for (const slash of deSlashEvents) {
          const totalLost = slash.lostStaking + slash.lostExternalStaking + slash.lostExternalUnstaking;
          const amount = mutezToXTZ(totalLost);
          if (amount <= 0) continue;

          events.push({
            date: formatDate(new Date(slash.level).toISOString()),
            asset: "XTZ",
            amount,
            fee: 0,
            pnl: -amount,
            paymentToken: "XTZ",
            notes: `Tezos double-endorsing slash at level ${slash.level}`,
            txHash: `tezos-slash-de-${slash.id}`,
            tag: "slashing",
          });
        }
      }
    } catch {
      // Slashing queries are non-fatal — most accounts have none
    }

    return events;
  },
};
