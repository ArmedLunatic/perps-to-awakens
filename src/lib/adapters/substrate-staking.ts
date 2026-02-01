import { PerpsAdapter, AwakensEvent } from "../core/types";

type SubstrateChainConfig = {
  id: string;
  name: string;
  subscanBase: string;
  nativeToken: string;
  decimals: number;
  addressPrefix: string;
  stakingOnly?: boolean;
};

type SubscanRewardSlashItem = {
  event_index: string;
  block_num: number;
  amount: string;
  block_timestamp: number;
  event_id: string; // "Reward" or "Slash"
  extrinsic_hash: string;
};

type SubscanResponse = {
  code: number;
  message: string;
  data: {
    count: number;
    list: SubscanRewardSlashItem[] | null;
  };
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

function toHuman(raw: string, decimals: number): number {
  const value = Number(raw) / Math.pow(10, decimals);
  // Truncate to 8 decimal places (not round) for accounting correctness
  return Math.trunc(value * 1e8) / 1e8;
}

function createSubstrateStakingAdapter(config: SubstrateChainConfig): PerpsAdapter {
  return {
    id: `${config.id}-staking`,
    name: `${config.name} Staking`,
    mode: "strict",
    family: "substrate-staking",
    supports: ["staking_reward", "slashing"],
    blocks: ["open_position", "close_position", "funding_payment"],

    async getEvents(account: string): Promise<AwakensEvent[]> {
      const events: AwakensEvent[] = [];
      let page = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`${config.subscanBase}/api/v2/scan/account/reward_slash`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: account,
            row: pageSize,
            page,
          }),
        });

        if (!res.ok) {
          throw new Error(`Subscan API error for ${config.name}: HTTP ${res.status}`);
        }

        const data: SubscanResponse = await res.json();

        if (data.code !== 0) {
          throw new Error(`Subscan API error for ${config.name}: ${data.message}`);
        }

        const list = data.data.list;
        if (!list || list.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of list) {
          const amount = toHuman(item.amount, config.decimals);
          const isReward = item.event_id === "Reward";
          const isSlash = item.event_id === "Slash";

          if (!isReward && !isSlash) continue;

          events.push({
            date: formatDate(item.block_timestamp),
            asset: config.nativeToken,
            amount,
            fee: 0,
            pnl: isReward ? amount : -amount,
            paymentToken: config.nativeToken,
            notes: `${config.name} ${isReward ? "staking reward" : "slash"} at block ${item.block_num}`,
            txHash: `${item.extrinsic_hash}-${item.event_index}`,
            tag: isReward ? "staking_reward" : "slashing",
          });
        }

        if (list.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }

      return events;
    },
  };
}

// --- Chain configurations ---

const SUBSTRATE_CHAINS: SubstrateChainConfig[] = [
  { id: "polkadot", name: "Polkadot", subscanBase: "https://polkadot.api.subscan.io", nativeToken: "DOT", decimals: 10, addressPrefix: "1" },
  { id: "kusama", name: "Kusama", subscanBase: "https://kusama.api.subscan.io", nativeToken: "KSM", decimals: 12, addressPrefix: "2" },
  { id: "westend", name: "Westend", subscanBase: "https://westend.api.subscan.io", nativeToken: "WND", decimals: 12, addressPrefix: "42" },
  { id: "rococo", name: "Rococo", subscanBase: "https://rococo.api.subscan.io", nativeToken: "ROC", decimals: 12, addressPrefix: "42" },
  { id: "statemint", name: "Statemint", subscanBase: "https://assethub-polkadot.api.subscan.io", nativeToken: "DOT", decimals: 10, addressPrefix: "1" },
  { id: "statemine", name: "Statemine", subscanBase: "https://assethub-kusama.api.subscan.io", nativeToken: "KSM", decimals: 12, addressPrefix: "2" },
  { id: "bittensor", name: "Bittensor", subscanBase: "https://bittensor.api.subscan.io", nativeToken: "TAO", decimals: 9, addressPrefix: "42" },
  { id: "hydradx", name: "HydraDX", subscanBase: "https://hydradx.api.subscan.io", nativeToken: "HDX", decimals: 12, addressPrefix: "63" },
  { id: "astar", name: "Astar", subscanBase: "https://astar.api.subscan.io", nativeToken: "ASTR", decimals: 18, addressPrefix: "5" },
  { id: "shiden", name: "Shiden", subscanBase: "https://shiden.api.subscan.io", nativeToken: "SDN", decimals: 18, addressPrefix: "5" },
  { id: "moonbeam", name: "Moonbeam", subscanBase: "https://moonbeam.api.subscan.io", nativeToken: "GLMR", decimals: 18, addressPrefix: "1284", stakingOnly: true },
  { id: "moonriver", name: "Moonriver", subscanBase: "https://moonriver.api.subscan.io", nativeToken: "MOVR", decimals: 18, addressPrefix: "1285", stakingOnly: true },
];

// Export individual adapters
export const polkadotStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[0]);
export const kusamaStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[1]);
export const westendStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[2]);
export const rococoStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[3]);
export const statemintStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[4]);
export const statemineStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[5]);
export const bittensorStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[6]);
export const hydradxStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[7]);
export const astarStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[8]);
export const shidenStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[9]);
export const moonbeamStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[10]);
export const moonriverStakingAdapter = createSubstrateStakingAdapter(SUBSTRATE_CHAINS[11]);
