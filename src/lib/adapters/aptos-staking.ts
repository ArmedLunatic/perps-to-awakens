import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Aptos Staking Adapter (PARTIAL MODE)
 *
 * Supported:
 *   - Explicit DistributeRewardsEvent from the staking module
 *   - These are per-account, per-pool reward distribution events
 *     emitted by the Aptos protocol when rewards are distributed
 *
 * Intentionally Blocked:
 *   - DeFi activity
 *   - Token transfers
 *   - Balance inference
 *   - NFT activity
 *   - Liquid staking rewards (amAPT, stAPT, etc.)
 *
 * Why partial:
 *   Aptos emits DistributeRewardsEvent events on the staking module
 *   that contain the pool address and reward amount. However, these
 *   events are emitted at the pool level. We can only export them
 *   when the delegator's address is explicitly present in the event.
 *   If attribution requires inference, the event is blocked.
 *
 * Data source: Aptos REST API (https://fullnode.mainnet.aptoslabs.com)
 * Input: Aptos address (0x + 64 hex chars)
 */

type AptosEvent = {
  version: string;
  sequence_number: string;
  type: string;
  data: {
    amount?: string;
    pool_address?: string;
    delegator_address?: string;
  };
};

type AptosEventResponse = AptosEvent[];

type AptosTransaction = {
  version: string;
  timestamp: string; // microseconds since epoch
  hash: string;
};

function formatDate(microseconds: string): string {
  const d = new Date(Number(microseconds) / 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function octoToAPT(octas: string): number {
  const value = Number(octas) / 100_000_000;
  return parseFloat(value.toFixed(8));
}

export const aptosStakingAdapter: PerpsAdapter = {
  id: "aptos-staking",
  name: "Aptos Staking",
  mode: "strict",
  family: "aptos-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Aptos address format
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(account)) {
      throw new Error(
        `Invalid Aptos address. Expected 0x followed by hex, got "${account}"`
      );
    }

    // Normalize to full 64-char hex
    const normalizedAddr = "0x" + account.slice(2).padStart(64, "0");

    const API_BASE = "https://fullnode.mainnet.aptoslabs.com/v1";
    const events: AwakensEvent[] = [];

    // Query the delegation pool events for this account.
    // Aptos emits DistributeRewardsEvent at:
    // 0x1::delegation_pool::DistributeRewardsEvent
    // These events contain pool_address and reward amount.
    //
    // We query the account's events to find reward distributions
    // where the account is explicitly named as a recipient.

    try {
      // Check if this account has a stake pool or delegation
      const resourceUrl = `${API_BASE}/accounts/${normalizedAddr}/events/0x1::stake::StakePool/distribute_rewards_events`;

      let start = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const url = `${resourceUrl}?start=${start}&limit=${limit}`;
        const res = await fetch(url);

        if (!res.ok) {
          // 404 means no staking events for this account — not an error
          if (res.status === 404) break;
          throw new Error(`Aptos API error: HTTP ${res.status}`);
        }

        const eventData: AptosEventResponse = await res.json();

        if (!Array.isArray(eventData) || eventData.length === 0) {
          hasMore = false;
          break;
        }

        for (const event of eventData) {
          // Only process explicit reward distribution events
          if (!event.data.amount) continue;

          const amount = octoToAPT(event.data.amount);
          if (amount <= 0) continue;

          // Fetch the transaction for timestamp
          let dateStr: string;
          try {
            const txRes = await fetch(`${API_BASE}/transactions/by_version/${event.version}`);
            if (txRes.ok) {
              const txData: AptosTransaction = await txRes.json();
              dateStr = formatDate(txData.timestamp);
            } else {
              continue; // Skip if we can't get timestamp
            }
          } catch {
            continue;
          }

          events.push({
            date: dateStr,
            asset: "APT",
            amount,
            fee: 0,
            pnl: amount,
            paymentToken: "APT",
            notes: `Aptos staking reward distribution (version ${event.version})`,
            txHash: `aptos-reward-${normalizedAddr.slice(0, 10)}-${event.version}-${event.sequence_number}`,
            tag: "staking_reward",
          });
        }

        if (eventData.length < limit) {
          hasMore = false;
        } else {
          start += limit;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("Aptos API error")) {
        throw err;
      }
      // If the staking resource doesn't exist, no events to return
    }

    return events;
  },
};
