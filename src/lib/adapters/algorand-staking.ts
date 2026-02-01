import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Algorand Staking Adapter (STRICT MODE)
 *
 * Supported:
 *   - Explicit participation rewards (Algorand Indexer reward transactions)
 *
 * Intentionally Blocked:
 *   - DeFi activity (AMM, lending, etc.)
 *   - Token transfers
 *   - Balance inference / balance delta computation
 *   - ASA (Algorand Standard Asset) rewards
 *   - Governance rewards (off-chain distribution, not protocol-emitted)
 *
 * Why strict:
 *   Algorand emits explicit reward payment transactions that are indexed
 *   by the Algorand Indexer. Each reward event contains the recipient,
 *   amount, and round number as discrete protocol events.
 *   We only export these protocol-emitted reward transactions.
 *
 * Data source: Algorand Indexer API (https://mainnet-idx.algonode.cloud)
 * Input: Algorand address (58-character base32 string)
 */

type AlgorandRewardTransaction = {
  id: string;
  "round-time": number;
  "payment-transaction"?: {
    amount: number;
    receiver: string;
  };
  "rewards-earned"?: number;
  "confirmed-round": number;
  "tx-type": string;
};

type AlgorandSearchResponse = {
  transactions: AlgorandRewardTransaction[];
  "next-token"?: string;
};

function formatDate(unixTimestamp: number): string {
  const d = new Date(unixTimestamp * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

function microAlgoToAlgo(microAlgo: number): number {
  const value = microAlgo / 1_000_000;
  return Math.trunc(value * 1e8) / 1e8; // Truncate to 8 decimal places (not round) for accounting correctness
}

export const algorandStakingAdapter: PerpsAdapter = {
  id: "algorand-staking",
  name: "Algorand Staking",
  mode: "strict",
  family: "algorand-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Algorand address format (58-char base32)
    if (!/^[A-Z2-7]{58}$/.test(account)) {
      throw new Error(
        `Invalid Algorand address. Expected a 58-character base32 address, got "${account}"`
      );
    }

    const API_BASE = "https://mainnet-idx.algonode.cloud/v2";
    const events: AwakensEvent[] = [];
    let nextToken: string | undefined = undefined;
    let pageCount = 0;
    const MAX_PAGES = 50;

    // Fetch transactions where this account earned participation rewards.
    // The Algorand Indexer returns the "rewards-earned" field on transactions
    // where the protocol distributed participation rewards to this account.
    // These are explicit protocol events, not balance deltas.
    while (pageCount < MAX_PAGES) {
      let url = `${API_BASE}/accounts/${account}/transactions?limit=100`;
      if (nextToken) {
        url += `&next=${nextToken}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Algorand account not found. Check the address format.");
        }
        throw new Error(`Algorand Indexer error: HTTP ${res.status}`);
      }

      const data: AlgorandSearchResponse = await res.json();

      if (!data.transactions || data.transactions.length === 0) {
        break;
      }

      for (const tx of data.transactions) {
        // Only export transactions that include explicit participation rewards
        // The "rewards-earned" field is set by the protocol when distributing
        // participation rewards — this is NOT a balance delta
        const rewardsEarned = tx["rewards-earned"];
        if (!rewardsEarned || rewardsEarned <= 0) continue;

        const amount = microAlgoToAlgo(rewardsEarned);
        if (amount <= 0) continue;

        events.push({
          date: formatDate(tx["round-time"]),
          asset: "ALGO",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "ALGO",
          notes: `Algorand participation reward (round ${tx["confirmed-round"]})`,
          txHash: `${tx.id}-reward`,
          tag: "staking_reward",
        });
      }

      if (!data["next-token"]) break;
      nextToken = data["next-token"];
      pageCount++;
    }

    return events;
  },
};
