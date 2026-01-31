import { PerpsAdapter, AwakensEvent } from "../core/types";

/**
 * Kadena Adapter (PARTIAL MODE — BLOCKED FOR MOST ACTIVITY)
 *
 * Supported:
 *   - Explicit coinbase (mining) rewards where the miner address
 *     is explicitly stated in the block reward event
 *
 * Intentionally Blocked:
 *   - Per-account mining rewards that are not explicit in block events
 *   - Gas fees as income (requires inference)
 *   - DeFi activity (Kaddex, etc.)
 *   - Token transfers
 *   - Balance inference
 *
 * Why partial:
 *   Kadena is a multi-chain (Chainweb) PoW network. Block rewards
 *   are emitted as explicit coinbase events with miner address and
 *   amount in the block header. However, per-account attribution
 *   depends on whether the queried address is the explicit miner.
 *   We only export rewards where the protocol explicitly names
 *   the recipient in the coinbase event.
 *
 * Data source: Kadena Chainweb Data API (https://api.chainweb.com)
 * Input: Kadena account (k:... format)
 */

type KadenaTxResult = {
  reqKey: string;
  result: {
    status: string;
    data: unknown;
  };
  events: {
    name: string;
    module: { namespace: string | null; name: string };
    params: (string | number)[];
  }[];
  metaData: {
    blockTime: number;
    blockHeight: number;
  };
};

type KadenaSearchResponse = {
  items: KadenaTxResult[];
  next?: string;
};

function formatDate(blockTimeMicro: number): string {
  // Kadena blockTime is in microseconds
  const d = new Date(blockTimeMicro / 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export const kadenaStakingAdapter: PerpsAdapter = {
  id: "kadena-mining",
  name: "Kadena Mining Rewards",
  mode: "strict",
  family: "kadena-mining",
  supports: ["staking_reward"],
  blocks: ["open_position", "close_position", "funding_payment", "slashing"],

  async getEvents(account: string): Promise<AwakensEvent[]> {
    // Validate Kadena account format (k:hex or w:hex or simple name)
    if (!/^(k:|w:)[a-f0-9]{64}$/.test(account) && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(account)) {
      throw new Error(
        `Invalid Kadena account. Expected k:<pubkey> format (e.g., k:abc123...), got "${account}"`
      );
    }

    const API_BASE = "https://api.chainweb.com/chainweb/0.0/mainnet01";
    const events: AwakensEvent[] = [];

    // Query across all 20 Kadena chains (chain IDs 0-19)
    // We look for coinbase events where this account is the explicit miner
    for (let chainId = 0; chainId < 20; chainId++) {
      try {
        const url = `${API_BASE}/chain/${chainId}/pact/api/v1/local`;

        // Query for coin.TRANSFER events where sender is "" (coinbase)
        // and receiver is the queried account. This is the explicit
        // protocol reward event — not a balance delta.
        const pactQuery = {
          pactCode: `(coin.get-balance "${account}")`,
          envData: {},
          meta: {
            chainId: String(chainId),
            sender: "",
            gasLimit: 100000,
            gasPrice: 0.00000001,
            ttl: 28800,
          },
          networkId: "mainnet01",
        };

        // Note: Direct Pact local calls don't return historical events.
        // For mining rewards, we need the Chainweb Data search endpoint.
        const searchUrl = `https://api.chainweb.com/chainweb/0.0/mainnet01/chain/${chainId}/pact/api/v1/search?search=${encodeURIComponent(account)}&limit=50`;

        const res = await fetch(searchUrl, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) continue; // Chain may not have activity

        let data: KadenaSearchResponse;
        try {
          data = await res.json();
        } catch {
          continue;
        }

        if (!data.items || data.items.length === 0) continue;

        for (const tx of data.items) {
          // Only process coinbase events where this account is the explicit recipient
          for (const event of tx.events || []) {
            if (
              event.module.name === "coin" &&
              event.name === "TRANSFER" &&
              event.params.length >= 3 &&
              event.params[0] === "" && // sender is empty = coinbase
              event.params[1] === account // receiver is our account
            ) {
              const amount = Number(event.params[2]);
              if (isNaN(amount) || amount <= 0) continue;

              const truncatedAmount = parseFloat(amount.toFixed(8));

              events.push({
                date: formatDate(tx.metaData.blockTime),
                asset: "KDA",
                amount: truncatedAmount,
                fee: 0,
                pnl: truncatedAmount,
                paymentToken: "KDA",
                notes: `Kadena mining reward (chain ${chainId}, height ${tx.metaData.blockHeight})`,
                txHash: `${tx.reqKey}-coinbase-chain${chainId}`,
                tag: "staking_reward",
              });
            }
          }
        }
      } catch {
        // Non-fatal: skip chains that error
        continue;
      }
    }

    return events;
  },
};
