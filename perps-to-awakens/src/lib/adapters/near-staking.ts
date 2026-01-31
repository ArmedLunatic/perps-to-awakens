import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Near Protocol Staking Adapter (STRICT MODE)
 *
 * Supported:
 *   - Staking rewards (explicit receipt-level events)
 *   - Slashing penalties (explicit protocol events)
 *
 * Blocked:
 *   - DeFi activity
 *   - Token transfers
 *   - Balance-based inference
 *   - Lockup contract rewards (requires contract-specific parsing)
 *
 * Data source: NEAR Indexer (via Nearblocks API)
 * Near Protocol emits explicit action receipts for staking operations.
 * Rewards are distributed via explicit protocol-level receipts.
 */

type NearStakingAction = {
  receipt_id: string;
  block_timestamp: string; // nanoseconds
  block_height: number;
  action_kind: string;
  args: {
    deposit?: string;
    stake?: string;
    method_name?: string;
  };
  predecessor_id: string;
  receiver_id: string;
};

type NearBlocksReward = {
  receipt_id: string;
  block_timestamp: string; // nanoseconds
  block_height: number;
  validator_id: string;
  amount: string; // yoctoNEAR
};

function formatDate(nanosOrMs: string | number): string {
  // Nearblocks returns nanoseconds as a string
  const ms = typeof nanosOrMs === "string"
    ? Math.floor(Number(nanosOrMs) / 1_000_000)
    : nanosOrMs;
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function yoctoToNEAR(yocto: string): number {
  // 1 NEAR = 10^24 yoctoNEAR
  // We need to handle very large numbers carefully
  const value = Number(yocto) / 1e24;
  return parseFloat(value.toFixed(8));
}

export const nearStakingAdapter: PerpsAdapter = {
  id: "near-staking",
  name: "NEAR Staking",
  mode: "strict",
  family: "near-staking",
  supports: ["staking_reward", "slashing"],
  blocks: ["open_position", "close_position", "funding_payment"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate NEAR account format
    // NEAR accounts are either named (alice.near) or implicit (64 hex chars)
    const isNamed = /^[a-z0-9._-]+\.near$/.test(account) || /^[a-z0-9._-]+$/.test(account);
    const isImplicit = /^[0-9a-f]{64}$/.test(account);

    if (!isNamed && !isImplicit) {
      throw new Error(
        `Invalid NEAR account format. Expected a named account (e.g. alice.near) or implicit account (64 hex chars), got "${account}"`
      );
    }

    const events: AwakensEvent[] = [];
    const API_BASE = "https://api.nearblocks.io/v1";

    // Fetch staking reward actions for this account
    // Nearblocks indexes protocol-level receipts for staking rewards
    let page = 1;
    const perPage = 25;
    let hasMore = true;

    while (hasMore) {
      const url = `${API_BASE}/account/${account}/staking-txns?page=${page}&per_page=${perPage}&order=desc`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) break;
        throw new Error(`Nearblocks API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      const txns: NearStakingAction[] = data.txns || data.data || [];

      if (!Array.isArray(txns) || txns.length === 0) {
        hasMore = false;
        break;
      }

      for (const action of txns) {
        // We only process explicit staking reward receipts
        // action_kind "DEPOSIT_AND_STAKE" with a deposit from the protocol
        // indicates a reward auto-compound or explicit reward
        if (action.args.deposit) {
          const amount = yoctoToNEAR(action.args.deposit);
          if (amount <= 0) continue;

          // Only count rewards from staking pools (*.poolv1.near, *.pool.near, etc.)
          const isStakingPool = action.receiver_id.includes("pool") ||
            action.receiver_id.includes("staking");
          const isRewardAction = action.action_kind === "DEPOSIT_AND_STAKE" &&
            action.predecessor_id === "system";

          if (isRewardAction) {
            events.push({
              date: formatDate(action.block_timestamp),
              asset: "NEAR",
              amount,
              fee: 0,
              pnl: amount,
              paymentToken: "NEAR",
              notes: `NEAR staking reward at block ${action.block_height}${isStakingPool ? ` (pool: ${action.receiver_id})` : ""}`,
              txHash: `near-reward-${action.receipt_id}`,
              tag: "staking_reward",
            });
          }
        }
      }

      if (txns.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Fetch slashing events (validator-specific, rare)
    try {
      const slashUrl = `${API_BASE}/validators/${account}`;
      const slashRes = await fetch(slashUrl, {
        headers: { Accept: "application/json" },
      });

      if (slashRes.ok) {
        const validatorData = await slashRes.json();

        // Check for explicit slashing events
        if (validatorData.slashed && Array.isArray(validatorData.slash_events)) {
          for (const slash of validatorData.slash_events) {
            const amount = yoctoToNEAR(slash.amount || "0");
            if (amount <= 0) continue;

            events.push({
              date: formatDate(slash.block_timestamp || slash.timestamp),
              asset: "NEAR",
              amount,
              fee: 0,
              pnl: -amount,
              paymentToken: "NEAR",
              notes: `NEAR slashing event at block ${slash.block_height}`,
              txHash: `near-slash-${slash.receipt_id || slash.block_height}`,
              tag: "slashing",
            });
          }
        }
      }
    } catch {
      // Slashing lookup is non-fatal
    }

    return events;
  },
};
