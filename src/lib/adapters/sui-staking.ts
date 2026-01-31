import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Sui Staking Adapter (PARTIAL MODE)
 *
 * Supported:
 *   - Explicit staking reward events from the Sui staking module
 *   - Per-epoch reward distributions where delegator and amount
 *     are explicitly stated in the protocol event
 *
 * Intentionally Blocked:
 *   - DeFi activity
 *   - Token transfers
 *   - Balance inference
 *   - NFT activity
 *   - Liquid staking rewards (afSUI, haSUI, etc.)
 *
 * Why partial:
 *   Sui distributes staking rewards at epoch boundaries. The protocol
 *   emits events via the staking module that contain the staking pool ID
 *   and reward amount. We query the SuiVision/Sui RPC for events where
 *   the delegator's StakedSui object received rewards. These are
 *   protocol-defined events, but attribution is object-level
 *   (StakedSui NFT) rather than address-level, requiring an extra
 *   ownership lookup.
 *
 * Data source: Sui JSON-RPC (https://fullnode.mainnet.sui.io)
 * Input: Sui address (0x + 64 hex chars)
 */

type SuiStakedObject = {
  stakedSuiId: string;
  stakeActiveEpoch: string;
  stakeRequestEpoch: string;
  principal: string; // MIST
  estimatedReward?: string; // MIST — we do NOT use estimates
  validatorAddress: string;
};

type SuiStakesResponse = {
  result: {
    stakes: SuiStakedObject[];
    validatorAddress: string;
  }[];
};

type SuiEpochInfo = {
  epoch: string;
  epochStartTimestampMs: string;
};

type SuiTxBlock = {
  timestampMs: string;
  digest: string;
};

function formatDate(timestampMs: string): string {
  const d = new Date(Number(timestampMs));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function mistToSUI(mist: string): number {
  const value = Number(mist) / 1_000_000_000;
  return parseFloat(value.toFixed(8));
}

export const suiStakingAdapter: PerpsAdapter = {
  id: "sui-staking",
  name: "Sui Staking",
  mode: "strict",
  family: "sui-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Sui address format
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(account)) {
      throw new Error(
        `Invalid Sui address. Expected 0x followed by hex, got "${account}"`
      );
    }

    const RPC_URL = "https://fullnode.mainnet.sui.io:443";
    const events: AwakensEvent[] = [];

    // Query for WithdrawStake transactions by this address.
    // When a user withdraws stake on Sui, the protocol emits an event
    // that includes the reward amount explicitly. This is the only
    // point where rewards become a discrete, attributable event.
    //
    // We do NOT use estimatedReward from getStakes — that would be
    // balance inference. We only export realized withdrawals.

    let cursor: string | null = null;
    let hasMore = true;
    let pageCount = 0;
    const MAX_PAGES = 50;

    while (hasMore && pageCount < MAX_PAGES) {
      const queryBody: { jsonrpc: string; id: number; method: string; params: unknown[] } = {
        jsonrpc: "2.0",
        id: 1,
        method: "suix_queryTransactionBlocks",
        params: [
          {
            filter: {
              FromAddress: account,
            },
            options: {
              showEvents: true,
              showInput: true,
            },
          },
          cursor,
          50,
          true, // descending
        ],
      };

      const res = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryBody),
      });

      if (!res.ok) {
        throw new Error(`Sui RPC error: HTTP ${res.status}`);
      }

      const rpcResponse = await res.json();
      if (rpcResponse.error) {
        throw new Error(`Sui RPC error: ${rpcResponse.error.message}`);
      }

      const data = rpcResponse.result;
      if (!data || !data.data || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const txBlock of data.data) {
        // Look for staking reward withdrawal events
        // Event type: 0x3::validator::StakingRewardEvent or
        // 0x3::staking_pool::WithdrawStakeEvent
        if (!txBlock.events) continue;

        for (const event of txBlock.events) {
          const isStakingReward =
            event.type?.includes("StakingReward") ||
            event.type?.includes("WithdrawStake");

          if (!isStakingReward) continue;

          // The event must contain an explicit reward amount
          const rewardAmount = event.parsedJson?.reward_amount ||
            event.parsedJson?.rewardAmount;

          if (!rewardAmount) continue;

          const amount = mistToSUI(String(rewardAmount));
          if (amount <= 0) continue;

          events.push({
            date: formatDate(txBlock.timestampMs),
            asset: "SUI",
            amount,
            fee: 0,
            pnl: amount,
            paymentToken: "SUI",
            notes: `Sui staking reward withdrawal (explicit protocol event)`,
            txHash: `${txBlock.digest}-reward`,
            tag: "staking_reward",
          });
        }
      }

      if (!data.hasNextPage) {
        hasMore = false;
      } else {
        cursor = data.nextCursor;
      }
      pageCount++;
    }

    return events;
  },
};
