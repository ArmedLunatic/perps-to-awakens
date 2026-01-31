import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Avalanche Staking Adapter (STRICT MODE — Primary Network Only)
 *
 * Supported:
 *   - Validator staking rewards (explicit reward UTXOs)
 *   - Delegator staking rewards (explicit reward UTXOs)
 *
 * Intentionally Blocked:
 *   - Subnet DeFi activity
 *   - C-chain / X-chain transfers
 *   - Trade inference
 *   - Balance reconstruction
 *   - Liquid staking (sAVAX, etc.)
 *
 * Why strict:
 *   Avalanche P-chain emits explicit reward UTXOs when a validation or
 *   delegation period ends. These are discrete protocol events with
 *   deterministic amounts. We query completed staking periods and
 *   export only the reward portion.
 *
 * Data source: Glacier API (https://glacier-api.avax.network)
 * Input: P-chain address (P-avax1...)
 */

type GlacierRewardTransaction = {
  txHash: string;
  blockTimestamp: number;
  rewardAmountNanoAvax?: string;
  amountStakedNanoAvax?: string;
  nodeId: string;
  txType: string;
};

type GlacierRewardsResponse = {
  transactions: GlacierRewardTransaction[];
  nextPageToken?: string;
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function nanoAvaxToAvax(nanoAvax: string): number {
  const value = Number(nanoAvax) / 1_000_000_000;
  return parseFloat(value.toFixed(8));
}

export const avalancheStakingAdapter: PerpsAdapter = {
  id: "avalanche-staking",
  name: "Avalanche P-Chain Staking",
  mode: "strict",
  family: "avalanche-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate P-chain address format
    if (!/^P-avax1[a-z0-9]{38,}$/.test(account)) {
      throw new Error(
        `Invalid Avalanche P-chain address. Expected format: P-avax1..., got "${account}"`
      );
    }

    const API_BASE = "https://glacier-api.avax.network/v1/networks/mainnet";
    const events: AwakensEvent[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 50;

    // Fetch completed staking reward transactions from the P-chain.
    // Glacier API returns explicit reward UTXOs for validators and delegators.
    while (pageCount < MAX_PAGES) {
      let url = `${API_BASE}/blockchains/p-chain/transactions?addresses=${account}&txTypes=AddValidatorTx,AddDelegatorTx&pageSize=100&sortOrder=desc`;
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Avalanche P-chain address not found.");
        }
        throw new Error(`Glacier API error: HTTP ${res.status}`);
      }

      const data: GlacierRewardsResponse = await res.json();

      if (!data.transactions || data.transactions.length === 0) {
        break;
      }

      for (let i = 0; i < data.transactions.length; i++) {
        const tx = data.transactions[i];

        // Only export if explicit reward amount is present
        // rewardAmountNanoAvax is the protocol-computed reward, not a balance delta
        if (!tx.rewardAmountNanoAvax) continue;

        const amount = nanoAvaxToAvax(tx.rewardAmountNanoAvax);
        if (amount <= 0) continue;

        const txType = tx.txType === "AddValidatorTx" ? "validator" : "delegator";

        events.push({
          date: formatDate(tx.blockTimestamp),
          asset: "AVAX",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "AVAX",
          notes: `Avalanche P-chain ${txType} staking reward (node: ${tx.nodeId})`,
          txHash: `${tx.txHash}-reward-${i}`,
          tag: "staking_reward",
        });
      }

      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
      pageCount++;
    }

    return events;
  },
};
