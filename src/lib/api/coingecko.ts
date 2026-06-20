import { sleep } from '../utils';

const BASE = 'https://api.coingecko.com/api/v3';
const MIN_REQUEST_INTERVAL_MS = 1500;
const MAX_RETRIES = 1;

// In-memory cache
const priceCache = new Map<string, number>();
const histPriceCache = new Map<string, number>(); // key: `${coinId}:${dateStr}`
const priceHistoryCache = new Map<string, Array<{ date: string; price: number }>>();
const symbolToIdCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<unknown>>();
let nextRequestAt = 0;

// CoinGecko platform IDs for EVM chains
const CHAIN_PLATFORM: Record<string, string> = {
  base: 'base',
  ethereum: 'ethereum',
  polygon: 'polygon-pos',
  arbitrum: 'arbitrum-one',
  optimism: 'optimistic-ethereum',
};

// Known symbol → CoinGecko ID mappings (augments CoinGecko search)
const KNOWN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  MATIC: 'matic-network',
  POL: 'matic-network',
  ARB: 'arbitrum',
  OP: 'optimism',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  CRV: 'curve-dao-token',
  SNX: 'havven',
  MKR: 'maker',
  COMP: 'compound-governance-token',
  SUSHI: 'sushi',
  '1INCH': '1inch',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  stETH: 'staked-ether',
  cbETH: 'coinbase-wrapped-staked-eth',
  rETH: 'rocket-pool-eth',
  BRETT: 'brett',
  DEGEN: 'degen-base',
  HIGHER: 'higher',
  TOSHI: 'toshi',
  PRIME: 'echelon-prime',
  VIRTUAL: 'virtual-protocol',
  AIXBT: 'aixbt-by-virtuals',
  cbBTC: 'coinbase-wrapped-btc',
};

async function cgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();
  const pending = pendingRequests.get(cacheKey) as Promise<T> | undefined;
  if (pending) return pending;

  const request = fetchWithRateLimit<T>(url, path);
  pendingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function fetchWithRateLimit<T>(url: URL, path: string, attempt = 0): Promise<T> {
  const now = Date.now();
  const waitMs = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_INTERVAL_MS;
  if (waitMs > 0) await sleep(waitMs);

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 8000);
    return fetchWithRateLimit(url, path, attempt + 1);
  }

  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

/** Get current prices for multiple coin IDs. Returns map { id → priceUsd } */
export async function getPrices(coinIds: string[]): Promise<Record<string, number>> {
  const missing = coinIds.filter((id) => !priceCache.has(id));
  if (missing.length > 0) {
    const chunks = chunk(missing, 50);
    for (const ch of chunks) {
      const data = await cgFetch<Record<string, { usd: number }>>('/simple/price', {
        ids: ch.join(','),
        vs_currencies: 'usd',
      });
      for (const [id, val] of Object.entries(data)) {
        priceCache.set(id, val.usd);
      }
    }
  }
  return Object.fromEntries(coinIds.map((id) => [id, priceCache.get(id) ?? 0]));
}

/** Get price of a single coin on a given date (YYYY-MM-DD) */
export async function getHistoricalPrice(coinId: string, dateStr: string): Promise<number | null> {
  const cacheKey = `${coinId}:${dateStr}`;
  if (histPriceCache.has(cacheKey)) return histPriceCache.get(cacheKey)!;

  const [y, m, d] = dateStr.split('-');
  const cgDate = `${d}-${m}-${y}`; // DD-MM-YYYY

  try {
    const data = await cgFetch<{ market_data?: { current_price?: { usd?: number } } }>(
      `/coins/${coinId}/history`,
      { date: cgDate, localization: 'false' },
    );
    const price = data.market_data?.current_price?.usd ?? null;
    if (price != null) histPriceCache.set(cacheKey, price);
    return price;
  } catch {
    return null;
  }
}

/** Resolve token symbol → CoinGecko ID (best-effort, KNOWN_IDS only — no API call) */
export async function resolveSymbolToId(symbol: string | null | undefined): Promise<string | null> {
  if (!symbol) return null;
  const upper = symbol.toUpperCase();
  if (KNOWN_IDS[upper]) return KNOWN_IDS[upper];
  // Skip API search for unknown tokens — too slow, most won't be listed anyway
  return null;
}

/**
 * Batch-fetch USD prices for ERC-20 tokens by contract address.
 * Uses CoinGecko's /simple/token_price/{platform} endpoint.
 * Returns map { contractAddress_lowercase → priceUsd }
 */
export async function getTokenPricesByAddress(
  chainKey: string,
  addresses: string[],
): Promise<Record<string, number>> {
  const platform = CHAIN_PLATFORM[chainKey];
  if (!platform || addresses.length === 0) return {};

  const result: Record<string, number> = {};
  const validAddresses = [...new Set(addresses.map((addr) => addr.toLowerCase()))]
    .filter((addr) => /^0x[0-9a-f]{40}$/.test(addr) && addr !== '0x0000000000000000000000000000000000000000');
  const chunks = chunk(validAddresses, 50);

  for (const ch of chunks) {
    try {
      const data = await cgFetch<Record<string, { usd?: number }>>(
        `/simple/token_price/${platform}`,
        {
          contract_addresses: ch.join(','),
          vs_currencies: 'usd',
        },
      );
      for (const [addr, val] of Object.entries(data)) {
        if (val.usd != null) result[addr.toLowerCase()] = val.usd;
      }
    } catch {
      // ignore errors for unknown tokens
    }
  }

  return result;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Get price history using market_chart/range.
 * Keep callers on short ranges: CoinGecko's browser/free API rejects large windows.
 */
export async function getCoinPriceHistoryRange(
  coinId: string,
  fromTs: number,
  toTs: number,
): Promise<Array<{ date: string; price: number }>> {
  const cacheKey = `range:${coinId}:${fromTs}:${toTs}`;
  if (priceHistoryCache.has(cacheKey)) return priceHistoryCache.get(cacheKey)!;

  try {
    const data = await cgFetch<{ prices: [number, number][] }>(
      `/coins/${coinId}/market_chart/range`,
      {
        vs_currency: 'usd',
        from: String(fromTs),
        to: String(toTs),
      },
    );
    // Deduplicate by date (keep last value per day)
    const byDate = new Map<string, number>();
    for (const [ts, price] of data.prices) {
      byDate.set(new Date(ts).toISOString().slice(0, 10), price);
    }
    const history = [...byDate.entries()].map(([date, price]) => ({ date, price }));
    priceHistoryCache.set(cacheKey, history);
    return history;
  } catch {
    return [];
  }
}

/** Get portfolio value history for last N days (≤365 free tier) */
export async function getCoinPriceHistory(
  coinId: string,
  days: number,
): Promise<Array<{ date: string; price: number }>> {
  const cacheKey = `days:${coinId}:${days}`;
  if (priceHistoryCache.has(cacheKey)) return priceHistoryCache.get(cacheKey)!;

  try {
    const data = await cgFetch<{ prices: [number, number][] }>(
      `/coins/${coinId}/market_chart`,
      { vs_currency: 'usd', days: String(days), interval: 'daily' },
    );
    const history = data.prices.map(([ts, price]) => ({
      date: new Date(ts).toISOString().slice(0, 10),
      price,
    }));
    priceHistoryCache.set(cacheKey, history);
    return history;
  } catch {
    return [];
  }
}
