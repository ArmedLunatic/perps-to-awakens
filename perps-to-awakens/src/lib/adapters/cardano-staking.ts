import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Cardano Staking Adapter (STRICT MODE, PARTIAL SUPPORT)
 *
 * Supported:
 *   - Reward WITHDRAWAL events only (explicit on-chain transactions)
 *
 * Intentionally Blocked:
 *   - Epoch reward accrual (not an on-chain event; computed by protocol off-ledger)
 *   - Balance snapshots (would require inference)
 *   - Stake pool delegation changes (not accounting events)
 *   - Token rewards / ISPO rewards (no standardized protocol event)
 *   - DeFi activity
 *
 * Why partial:
 *   Cardano accrues staking rewards per-epoch without an on-chain event.
 *   Rewards only appear on-chain when explicitly withdrawn via a
 *   MsgWithdrawRewards transaction. We ONLY export these withdrawal events
 *   because they are the only deterministic, protocol-defined accounting
 *   events. Epoch accruals require balance inference, which we refuse to do.
 *
 * Data source: Blockfrost API (https://cardano-mainnet.blockfrost.io)
 * Requires: BLOCKFROST_PROJECT_ID (passed as apiKey)
 */

type BlockfrostWithdrawalTx = {
  tx_hash: string;
  block_time: number;
};

type BlockfrostWithdrawalDetail = {
  address: string;
  amount: string; // lovelace
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

function lovelaceToADA(lovelace: string): number {
  const value = Number(lovelace) / 1_000_000;
  return parseFloat(value.toFixed(8));
}

export const cardanoStakingAdapter: PerpsAdapter = {
  id: "cardano-staking",
  name: "Cardano Staking",
  requiresAuth: true,
  mode: "strict",
  family: "cardano-staking",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string, options?): Promise<AwakensEvent[]> {
    if (!options?.apiKey) {
      throw new Error(
        "Cardano adapter requires a Blockfrost Project ID. " +
        "Get one free at https://blockfrost.io"
      );
    }

    // Validate Cardano stake address format (stake1...)
    // We require the stake address because reward withdrawals are per-stake-key
    const isStakeAddress = /^stake1[a-z0-9]{53}$/.test(account);
    const isBaseAddress = /^addr1[a-z0-9]{50,}$/.test(account);

    if (!isStakeAddress && !isBaseAddress) {
      throw new Error(
        `Invalid Cardano address. Expected a stake address (stake1...) or base address (addr1...), got "${account}"`
      );
    }

    const API_BASE = "https://cardano-mainnet.blockfrost.io/api/v0";
    const headers = { project_id: options.apiKey };

    // If base address provided, resolve to stake address
    let stakeAddress = account;
    if (isBaseAddress) {
      const addrRes = await fetch(`${API_BASE}/addresses/${account}`, { headers });
      if (!addrRes.ok) {
        throw new Error(`Blockfrost API error: HTTP ${addrRes.status}`);
      }
      const addrData = await addrRes.json();
      if (!addrData.stake_address) {
        throw new Error(
          "This address has no associated stake key. Reward withdrawals require a staking address."
        );
      }
      stakeAddress = addrData.stake_address;
    }

    const events: AwakensEvent[] = [];
    let page = 1;
    const limit = 100;
    let hasMore = true;

    // Fetch withdrawal history — these are the ONLY events we export
    // Each withdrawal is an explicit on-chain transaction
    while (hasMore) {
      const url = `${API_BASE}/accounts/${stakeAddress}/withdrawals?page=${page}&count=${limit}&order=desc`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) break; // No withdrawals found
        throw new Error(`Blockfrost API error: HTTP ${res.status}`);
      }

      const withdrawals: BlockfrostWithdrawalDetail[] = await res.json();

      if (!Array.isArray(withdrawals) || withdrawals.length === 0) {
        hasMore = false;
        break;
      }

      // For each withdrawal, we need the transaction details for timestamp
      for (let i = 0; i < withdrawals.length; i++) {
        const w = withdrawals[i] as BlockfrostWithdrawalDetail & { tx_hash: string };
        const amount = lovelaceToADA(w.amount);
        if (amount <= 0) continue;

        // Fetch tx details for timestamp
        let dateStr: string;
        try {
          const txRes = await fetch(`${API_BASE}/txs/${w.tx_hash}`, { headers });
          if (txRes.ok) {
            const txData: BlockfrostWithdrawalTx = await txRes.json();
            dateStr = formatDate(txData.block_time);
          } else {
            // If we can't get the timestamp, we cannot produce a valid event
            continue;
          }
        } catch {
          continue;
        }

        events.push({
          date: dateStr,
          asset: "ADA",
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: "ADA",
          notes: "Cardano staking reward withdrawal (on-chain event only; epoch accruals are intentionally excluded)",
          txHash: `${w.tx_hash}-withdrawal-${i}`,
          tag: "staking_reward",
        });
      }

      if (withdrawals.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return events;
  },
};
