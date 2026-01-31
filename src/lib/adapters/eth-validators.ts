import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Ethereum Validator Rewards Adapter (PARTIAL MODE)
 *
 * Supported:
 *   - Consensus-layer (beacon chain) rewards only
 *   - Attestation rewards, proposer rewards, sync committee rewards
 *   - Slashing penalties
 *
 * Intentionally Blocked:
 *   - Execution-layer rewards (tx fees, priority fees)
 *   - MEV rewards (builder payments, Flashbots, etc.)
 *   - Withdrawal events (these are transfers, not reward events)
 *   - Restaking rewards (EigenLayer, etc.)
 *
 * Why partial:
 *   Ethereum validators earn rewards on both the consensus layer (beacon chain)
 *   and execution layer (tips + MEV). Execution-layer rewards are paid to
 *   fee recipient addresses via regular transactions and cannot be
 *   deterministically attributed to validation without inference.
 *   MEV rewards flow through builders and relays with no protocol-level event.
 *   We ONLY export consensus-layer rewards because these are the only
 *   rewards emitted by the protocol with deterministic attribution.
 *
 * Data source: Beaconcha.in API (https://beaconcha.in/api/v1)
 * Input: Validator index (numeric) or validator public key (0x...)
 */

type BeaconchainIncomeDetail = {
  attestation_head_reward: number;
  attestation_source_reward: number;
  attestation_target_reward: number;
  attestation_head_penalty: number;
  attestation_source_penalty: number;
  attestation_target_penalty: number;
  proposer_attestation_inclusion_reward: number;
  proposer_sync_inclusion_reward: number;
  proposer_slashing_inclusion_reward: number;
  sync_committee_reward: number;
  sync_committee_penalty: number;
  slashing_reward: number;
  slashing_penalty: number;
  proposal_missed: number;
  day: number;
  day_start: string; // ISO timestamp
  day_end: string;
};

type BeaconchainResponse = {
  status: string;
  data: BeaconchainIncomeDetail[];
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

function gweiToETH(gwei: number): number {
  const value = gwei / 1_000_000_000;
  return parseFloat(value.toFixed(8));
}

export const ethValidatorAdapter: PerpsAdapter = {
  id: "eth-validator",
  name: "Ethereum Validator",
  mode: "strict",
  family: "eth-validator",
  supports: ["staking_reward", "slashing"],
  blocks: ["open_position", "close_position", "funding_payment"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate: accept validator index (numeric) or pubkey (0x + 96 hex chars)
    const isIndex = /^\d+$/.test(account);
    const isPubkey = /^0x[0-9a-fA-F]{96}$/.test(account);

    if (!isIndex && !isPubkey) {
      throw new Error(
        `Invalid validator identifier. Expected a validator index (e.g. 12345) or public key (0x... 96 hex chars), got "${account}"`
      );
    }

    const events: AwakensEvent[] = [];
    const API_BASE = "https://beaconcha.in/api/v1";

    // Fetch daily income history (consensus-layer only)
    // Beaconcha.in provides per-day aggregated CL rewards with full breakdown
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${API_BASE}/validator/${account}/incomedetailhistory?offset=${offset}&limit=${limit}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(
            `Validator not found. Please provide a valid validator index or public key.`
          );
        }
        throw new Error(`Beaconcha.in API error: HTTP ${res.status}`);
      }

      const data: BeaconchainResponse = await res.json();

      if (data.status !== "OK" || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const day of data.data) {
        // Calculate net consensus-layer reward for this day
        const totalReward =
          day.attestation_head_reward +
          day.attestation_source_reward +
          day.attestation_target_reward +
          day.proposer_attestation_inclusion_reward +
          day.proposer_sync_inclusion_reward +
          day.proposer_slashing_inclusion_reward +
          day.sync_committee_reward +
          day.slashing_reward;

        const totalPenalty =
          day.attestation_head_penalty +
          day.attestation_source_penalty +
          day.attestation_target_penalty +
          day.sync_committee_penalty +
          day.slashing_penalty;

        const netReward = totalReward - totalPenalty;

        if (netReward > 0) {
          const amount = gweiToETH(netReward);
          if (amount <= 0) continue;

          events.push({
            date: formatDate(day.day_start),
            asset: "ETH",
            amount,
            fee: 0,
            pnl: amount,
            paymentToken: "ETH",
            notes: `Ethereum CL reward day ${day.day} (consensus-layer only; EL rewards and MEV intentionally excluded)`,
            txHash: `eth-cl-reward-${account}-day-${day.day}`,
            tag: "staking_reward",
          });
        } else if (netReward < 0) {
          // Net negative = slashing or accumulated penalties exceeded rewards
          const amount = gweiToETH(Math.abs(netReward));
          if (amount <= 0) continue;

          events.push({
            date: formatDate(day.day_start),
            asset: "ETH",
            amount,
            fee: 0,
            pnl: -amount,
            paymentToken: "ETH",
            notes: `Ethereum CL penalty day ${day.day} (net penalties exceeded rewards)`,
            txHash: `eth-cl-penalty-${account}-day-${day.day}`,
            tag: "slashing",
          });
        }
        // netReward === 0: no event (nothing happened)
      }

      if (data.data.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return events;
  },
};
