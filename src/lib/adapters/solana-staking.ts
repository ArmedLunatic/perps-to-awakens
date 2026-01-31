import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Solana Staking Adapter (PARTIAL MODE)
 *
 * Supported:
 *   - Explicit staking reward credits (via Solana RPC getInflationReward)
 *
 * Intentionally Blocked:
 *   - Epoch rewards inferred from balance changes (we do NOT compare
 *     balances across epochs — that would be balance inference)
 *   - Swaps, DEX activity, Jupiter routes
 *   - NFT activity
 *   - Token transfers
 *   - Liquid staking (mSOL, jitoSOL, etc.)
 *   - MEV / Jito tips
 *
 * Why partial:
 *   Solana distributes staking rewards per-epoch as inflation credits.
 *   The RPC method `getInflationReward` returns the explicit per-account
 *   reward amount for each epoch. However, these are computed by the
 *   runtime (not emitted as on-chain transactions), so we classify this
 *   as partial support. The reward amount is protocol-defined and
 *   deterministic, but there is no discrete on-chain transaction hash.
 *   We use a synthetic tx hash (epoch-based) for uniqueness.
 *
 * Data source: Solana RPC (https://api.mainnet-beta.solana.com)
 * Input: Solana stake account address (base58)
 */

type SolanaInflationReward = {
  epoch: number;
  effectiveSlot: number;
  amount: number; // lamports
  postBalance: number; // lamports — we do NOT use this for inference
  commission: number | null;
};

function formatEpochDate(slot: number): string {
  // Solana slot to approximate UTC timestamp
  // Genesis: 2020-03-16 14:29:00 UTC, ~400ms per slot
  const GENESIS_TIMESTAMP = 1584368940;
  const SLOT_DURATION_SEC = 0.4;
  const timestamp = GENESIS_TIMESTAMP + slot * SLOT_DURATION_SEC;
  const d = new Date(timestamp * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function lamportsToSOL(lamports: number): number {
  const value = lamports / 1_000_000_000;
  return parseFloat(value.toFixed(8));
}

export const solanaStakingAdapter: PerpsAdapter = {
  id: "solana-staking",
  name: "Solana Staking",
  mode: "strict",
  family: "solana-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Solana address format (32-44 chars base58)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(account)) {
      throw new Error(
        `Invalid Solana address. Expected a base58-encoded address, got "${account}"`
      );
    }

    const RPC_URL = "https://api.mainnet-beta.solana.com";
    const events: AwakensEvent[] = [];

    // First, get the current epoch to know how far back to query
    const epochRes = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getEpochInfo",
      }),
    });

    if (!epochRes.ok) {
      throw new Error(`Solana RPC error: HTTP ${epochRes.status}`);
    }

    const epochData = await epochRes.json();
    if (epochData.error) {
      throw new Error(`Solana RPC error: ${epochData.error.message}`);
    }

    const currentEpoch: number = epochData.result.epoch;

    // Query inflation rewards for recent epochs (batch of 10 at a time)
    // getInflationReward returns the protocol-computed reward per epoch.
    // This is NOT balance inference — it's the explicit reward amount
    // computed by the Solana runtime for this stake account.
    const MAX_EPOCHS_BACK = 100;
    const BATCH_SIZE = 10;

    for (let startEpoch = currentEpoch - 1; startEpoch >= Math.max(0, currentEpoch - MAX_EPOCHS_BACK); startEpoch -= BATCH_SIZE) {
      const batchEnd = Math.max(0, startEpoch - BATCH_SIZE + 1);

      for (let epoch = startEpoch; epoch >= batchEnd; epoch--) {
        const rewardRes = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getInflationReward",
            params: [[account], { epoch }],
          }),
        });

        if (!rewardRes.ok) continue;

        const rewardData = await rewardRes.json();
        if (rewardData.error || !rewardData.result) continue;

        const reward: SolanaInflationReward | null = rewardData.result[0];
        if (!reward || reward.amount <= 0) continue;

        const amount = lamportsToSOL(reward.amount);
        if (amount <= 0) continue;

        events.push({
          date: formatEpochDate(reward.effectiveSlot),
          asset: "SOL",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "SOL",
          notes: `Solana staking reward epoch ${reward.epoch} (protocol-computed; not inferred from balance)`,
          txHash: `sol-staking-reward-${account.slice(0, 8)}-epoch-${reward.epoch}`,
          tag: "staking_reward",
        });
      }
    }

    return events;
  },
};
