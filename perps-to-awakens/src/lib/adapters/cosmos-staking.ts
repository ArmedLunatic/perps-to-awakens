import { PerpsAdapter, AwakensEvent } from "../core/types";

type CosmosChainConfig = {
  id: string;
  name: string;
  lcdBase: string;
  nativeToken: string;
  denom: string;
  decimals: number;
  bech32Prefix: string;
};

type CosmosTxEvent = {
  type: string;
  attributes: { key: string; value: string }[];
};

type CosmosTxLog = {
  events: CosmosTxEvent[];
};

type CosmosTx = {
  txhash: string;
  timestamp: string;
  logs?: CosmosTxLog[];
  events?: CosmosTxEvent[];
};

type CosmosTxSearchResponse = {
  tx_responses: CosmosTx[] | null;
  pagination?: {
    next_key: string | null;
    total: string;
  };
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

function toHuman(raw: string, decimals: number): number {
  const value = Number(raw) / Math.pow(10, decimals);
  return parseFloat(value.toFixed(8));
}

function extractRewardAmount(
  tx: CosmosTx,
  denom: string,
): string | null {
  // Try logs first (older Cosmos SDK), then top-level events (newer SDK)
  const eventSources = [
    ...(tx.logs?.flatMap((l) => l.events) ?? []),
    ...(tx.events ?? []),
  ];

  for (const event of eventSources) {
    if (event.type === "withdraw_rewards" || event.type === "coin_received") {
      const amountAttr = event.attributes.find((a) => a.key === "amount");
      if (amountAttr?.value) {
        // Amount format: "12345uatom" or "12345uatom,6789uosmo"
        const parts = amountAttr.value.split(",");
        for (const part of parts) {
          if (part.endsWith(denom)) {
            return part.replace(denom, "");
          }
        }
      }
    }
  }
  return null;
}

function extractSlashAmount(
  tx: CosmosTx,
  denom: string,
): string | null {
  const eventSources = [
    ...(tx.logs?.flatMap((l) => l.events) ?? []),
    ...(tx.events ?? []),
  ];

  for (const event of eventSources) {
    if (event.type === "slash") {
      const amountAttr = event.attributes.find((a) => a.key === "amount");
      if (amountAttr?.value) {
        const parts = amountAttr.value.split(",");
        for (const part of parts) {
          if (part.endsWith(denom)) {
            return part.replace(denom, "");
          }
        }
      }
    }
  }
  return null;
}

function createCosmosStakingAdapter(config: CosmosChainConfig): PerpsAdapter {
  return {
    id: `${config.id}-staking`,
    name: `${config.name} Staking`,
    mode: "strict",
    family: "cosmos-staking",
    supports: ["staking_reward", "slashing"],
    blocks: ["open_position", "close_position", "funding_payment"],

    async getEvents(account: string): Promise<AwakensEvent[]> {
      const events: AwakensEvent[] = [];

      // Fetch reward withdrawal transactions
      const rewardUrl =
        `${config.lcdBase}/cosmos/tx/v1beta1/txs?events=` +
        encodeURIComponent(`message.sender='${account}'`) +
        `&events=` +
        encodeURIComponent(`message.action='/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'`) +
        `&order_by=ORDER_BY_DESC&pagination.limit=100`;

      const rewardRes = await fetch(rewardUrl);
      if (!rewardRes.ok) {
        throw new Error(`Cosmos LCD error for ${config.name}: HTTP ${rewardRes.status}`);
      }

      const rewardData: CosmosTxSearchResponse = await rewardRes.json();
      const rewardTxs = rewardData.tx_responses ?? [];

      for (let i = 0; i < rewardTxs.length; i++) {
        const tx = rewardTxs[i];
        const rawAmount = extractRewardAmount(tx, config.denom);
        if (!rawAmount) continue;

        const amount = toHuman(rawAmount, config.decimals);
        if (amount <= 0) continue;

        events.push({
          date: formatDate(tx.timestamp),
          asset: config.nativeToken,
          amount,
          fee: 0,
          pnl: amount,
          paymentToken: config.nativeToken,
          notes: `${config.name} staking reward withdrawal`,
          txHash: `${tx.txhash}-reward-${i}`,
          tag: "staking_reward",
        });
      }

      // Fetch slashing events (these are rarer)
      try {
        const slashUrl =
          `${config.lcdBase}/cosmos/tx/v1beta1/txs?events=` +
          encodeURIComponent(`slash.address='${account}'`) +
          `&order_by=ORDER_BY_DESC&pagination.limit=100`;

        const slashRes = await fetch(slashUrl);
        if (slashRes.ok) {
          const slashData: CosmosTxSearchResponse = await slashRes.json();
          const slashTxs = slashData.tx_responses ?? [];

          for (let i = 0; i < slashTxs.length; i++) {
            const tx = slashTxs[i];
            const rawAmount = extractSlashAmount(tx, config.denom);
            if (!rawAmount) continue;

            const amount = toHuman(rawAmount, config.decimals);
            if (amount <= 0) continue;

            events.push({
              date: formatDate(tx.timestamp),
              asset: config.nativeToken,
              amount,
              fee: 0,
              pnl: -amount,
              paymentToken: config.nativeToken,
              notes: `${config.name} slashing event`,
              txHash: `${tx.txhash}-slash-${i}`,
              tag: "slashing",
            });
          }
        }
      } catch {
        // Slashing query may not be supported on all chains — non-fatal
      }

      return events;
    },
  };
}

// --- Chain configurations ---

const COSMOS_CHAINS: CosmosChainConfig[] = [
  { id: "cosmos-hub", name: "Cosmos Hub", lcdBase: "https://rest.cosmos.directory/cosmoshub", nativeToken: "ATOM", denom: "uatom", decimals: 6, bech32Prefix: "cosmos" },
  { id: "osmosis", name: "Osmosis", lcdBase: "https://lcd.osmosis.zone", nativeToken: "OSMO", denom: "uosmo", decimals: 6, bech32Prefix: "osmo" },
  { id: "neutron", name: "Neutron", lcdBase: "https://rest.neutron.org", nativeToken: "NTRN", denom: "untrn", decimals: 6, bech32Prefix: "neutron" },
  { id: "juno", name: "Juno", lcdBase: "https://rest.cosmos.directory/juno", nativeToken: "JUNO", denom: "ujuno", decimals: 6, bech32Prefix: "juno" },
  { id: "stride", name: "Stride", lcdBase: "https://stride-fleet.main.stridenet.co", nativeToken: "STRD", denom: "ustrd", decimals: 6, bech32Prefix: "stride" },
  { id: "akash", name: "Akash", lcdBase: "https://rest.cosmos.directory/akash", nativeToken: "AKT", denom: "uakt", decimals: 6, bech32Prefix: "akash" },
  { id: "secret", name: "Secret Network", lcdBase: "https://lcd.secret.express", nativeToken: "SCRT", denom: "uscrt", decimals: 6, bech32Prefix: "secret" },
];

export const cosmosHubStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[0]);
export const osmosisStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[1]);
export const neutronStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[2]);
export const junoStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[3]);
export const strideStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[4]);
export const akashStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[5]);
export const secretStakingAdapter = createCosmosStakingAdapter(COSMOS_CHAINS[6]);
