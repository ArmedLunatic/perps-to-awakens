import { PerpsAdapter, AwakensEvent } from "../core/types";

type LevanaChainConfig = {
  id: string;
  name: string;
  lcdBase: string;
  factoryContract: string;
  bech32Prefix: string;
  settlementToken: string;
};

type LevanaTradeEntry = {
  trade_id: string;
  direction: string;
  entry_price: string;
  close_price?: string;
  pnl?: string;
  collateral: string;
  open_timestamp: number;
  close_timestamp?: number;
  tx_hash?: string;
};

type LevanaTradeHistoryResponse = {
  trades: LevanaTradeEntry[];
};

type LevanaMarketInfo = {
  market_addr: string;
  market_id: string;
};

type LevanaMarketsResponse = {
  markets: LevanaMarketInfo[];
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

function toBase64(obj: object): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

function createLevanaAdapter(config: LevanaChainConfig): PerpsAdapter {
  return {
    id: `levana-${config.id}`,
    name: `Levana (${config.name})`,
    mode: "assisted",
    family: "cosmwasm-perps",
    supports: ["open_position", "close_position"],
    blocks: ["funding_payment"],

    async getEvents(account: string): Promise<AwakensEvent[]> {
      const events: AwakensEvent[] = [];

      // Step 1: Query factory contract for list of markets
      const marketsQuery = toBase64({ markets: {} });
      const marketsUrl = `${config.lcdBase}/cosmwasm/wasm/v1/contract/${config.factoryContract}/smart/${marketsQuery}`;

      const marketsRes = await fetch(marketsUrl);
      if (!marketsRes.ok) {
        throw new Error(`Levana ${config.name}: failed to query factory contract (HTTP ${marketsRes.status})`);
      }

      const marketsBody = await marketsRes.json();
      const marketsData: LevanaMarketsResponse = marketsBody.data;

      if (!marketsData?.markets || marketsData.markets.length === 0) {
        return [];
      }

      // Step 2: Query each market for trade history
      for (const market of marketsData.markets) {
        const tradeQuery = toBase64({
          trade_history: { owner: account, start_after: null, limit: 100 },
        });
        const tradeUrl = `${config.lcdBase}/cosmwasm/wasm/v1/contract/${market.market_addr}/smart/${tradeQuery}`;

        let tradeRes: Response;
        try {
          tradeRes = await fetch(tradeUrl);
        } catch {
          // Skip markets that fail to respond
          continue;
        }

        if (!tradeRes.ok) continue;

        const tradeBody = await tradeRes.json();
        const tradeData: LevanaTradeHistoryResponse = tradeBody.data;

        if (!tradeData?.trades) continue;

        for (const trade of tradeData.trades) {
          const collateral = parseFloat(trade.collateral);
          const marketId = market.market_id || market.market_addr;

          if (trade.close_price && trade.pnl !== undefined) {
            // Closed trade
            const pnl = parseFloat(trade.pnl);
            events.push({
              date: formatDate(trade.close_timestamp ?? trade.open_timestamp),
              asset: marketId,
              amount: collateral,
              fee: 0,
              pnl: parseFloat(pnl.toFixed(8)),
              paymentToken: config.settlementToken,
              notes: `Levana ${config.name} ${trade.direction} close`,
              txHash: trade.tx_hash ?? `${market.market_addr}-${trade.trade_id}`,
              tag: "close_position",
            });
          } else {
            // Open trade (no pnl yet)
            events.push({
              date: formatDate(trade.open_timestamp),
              asset: marketId,
              amount: collateral,
              fee: 0,
              pnl: 0,
              paymentToken: config.settlementToken,
              notes: `Levana ${config.name} ${trade.direction} open`,
              txHash: trade.tx_hash ?? `${market.market_addr}-${trade.trade_id}`,
              tag: "open_position",
            });
          }
        }
      }

      return events;
    },
  };
}

// --- Levana deployments ---

const LEVANA_CHAINS: LevanaChainConfig[] = [
  {
    id: "osmosis",
    name: "Osmosis",
    lcdBase: "https://lcd.osmosis.zone",
    factoryContract: "osmo1ssw6x553kzqher0eqsiruj0987dxmmy0yxf96j9v0lqd6q0skjsqknppnw",
    bech32Prefix: "osmo",
    settlementToken: "USDC",
  },
  {
    id: "injective",
    name: "Injective",
    lcdBase: "https://lcd.injective.network",
    factoryContract: "inj1vdu3s39dl8t5l88tyqwuhzklsx9587adv8cnn9",
    bech32Prefix: "inj",
    settlementToken: "USDT",
  },
  {
    id: "neutron",
    name: "Neutron",
    lcdBase: "https://rest.neutron.org",
    factoryContract: "neutron1an6v6eezl5sxlsfqkqsjhswjdg7pqalhn5hxq2yddpkqflps32sq6hm3qf",
    bech32Prefix: "neutron",
    settlementToken: "USDC",
  },
  {
    id: "juno",
    name: "Juno",
    lcdBase: "https://rest.cosmos.directory/juno",
    factoryContract: "juno1smrp26pc2n25r4ee08fkx5k5ygmejnnwfvhwvg6gu2grsv9vstqq3udexv",
    bech32Prefix: "juno",
    settlementToken: "USDC",
  },
];

export const levanaOsmosisAdapter = createLevanaAdapter(LEVANA_CHAINS[0]);
export const levanaInjectiveAdapter = createLevanaAdapter(LEVANA_CHAINS[1]);
export const levanaNeutronAdapter = createLevanaAdapter(LEVANA_CHAINS[2]);
export const levanaJunoAdapter = createLevanaAdapter(LEVANA_CHAINS[3]);
