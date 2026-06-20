import type { TokenTransfer, NativeTx, TokenHolding, PnLSummary } from '../types';
import { resolveSymbolToId, getPrices, getCoinPriceHistoryRange } from './api/coingecko';
import dayjs from 'dayjs';

interface TxEvent {
  timeStamp: number;
  direction: 'in' | 'out';
  amount: number;
  tokenSymbol: string;
  tokenAddress: string; // 'native' for ETH/MATIC
  tokenDecimal: number;
  chainKey: string;
}

const TRACKED_ERC20: Record<string, Record<string, { symbol: string }>> = {
  base: {
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH' },
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC' },
    '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': { symbol: 'USDC' },
    '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2': { symbol: 'USDT' },
  },
  ethereum: {
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH' },
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC' },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT' },
  },
  polygon: {
    '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619': { symbol: 'WETH' },
    '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { symbol: 'USDC' },
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { symbol: 'USDC' },
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': { symbol: 'USDT' },
  },
  arbitrum: {
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { symbol: 'WETH' },
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC' },
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': { symbol: 'USDC' },
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT' },
  },
  optimism: {
    '0x4200000000000000000000000000000000000006': { symbol: 'WETH' },
    '0x0b2c639c533813f4aa9d7837caf62653d097ff85': { symbol: 'USDC' },
    '0x7f5c764cbc14f9669b88837ca1490cca17c31607': { symbol: 'USDC' },
    '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58': { symbol: 'USDT' },
  },
};

const STABLE_COIN_IDS = new Set(['usd-coin', 'tether']);

function trackedEvent(ev: TxEvent): TxEvent | null {
  if (ev.tokenAddress === 'native') {
    return ev.tokenSymbol.toUpperCase() === 'ETH'
      ? { ...ev, tokenSymbol: 'ETH' }
      : null;
  }

  const token = TRACKED_ERC20[ev.chainKey]?.[ev.tokenAddress.toLowerCase()];
  return token ? { ...ev, tokenSymbol: token.symbol } : null;
}

function historySourceId(coinId: string): string {
  return coinId === 'weth' ? 'ethereum' : coinId;
}

function transfersToEvents(
  erc20: TokenTransfer[],
  native: NativeTx[],
  chainKey: string,
  nativeSymbol: string,
): TxEvent[] {
  const events: TxEvent[] = [];
  for (const t of erc20) {
    events.push({
      timeStamp: t.timeStamp,
      direction: t.direction,
      amount: t.valueFormatted,
      tokenSymbol: t.tokenSymbol || 'UNKNOWN',
      tokenAddress: t.tokenAddress,
      tokenDecimal: t.tokenDecimal,
      chainKey,
    });
  }
  for (const t of native) {
    if (t.isError) continue;
    events.push({
      timeStamp: t.timeStamp,
      direction: t.direction,
      amount: t.valueFormatted,
      tokenSymbol: nativeSymbol,
      tokenAddress: 'native',
      tokenDecimal: 18,
      chainKey,
    });
  }
  return events.sort((a, b) => a.timeStamp - b.timeStamp);
}

interface CostBasisEntry {
  totalCost: number; // USD
  totalAmount: number;
}

export async function computeHoldings(
  erc20ByChain: Record<string, TokenTransfer[]>,
  nativeByChain: Record<string, NativeTx[]>,
  nativeBalanceByChain: Record<string, number>,
  nativeSymbolByChain: Record<string, string>,
  onProgress?: (msg: string) => void,
): Promise<{ holdings: TokenHolding[]; summary: PnLSummary }> {
  // Combine all events
  const allEvents: TxEvent[] = [];
  for (const [chainKey, transfers] of Object.entries(erc20ByChain)) {
    const native = nativeByChain[chainKey] ?? [];
    const symbol = nativeSymbolByChain[chainKey] ?? 'ETH';
    for (const ev of transfersToEvents(transfers, native, chainKey, symbol)) {
      const tracked = trackedEvent(ev);
      if (tracked) allEvents.push(tracked);
    }
  }

  // Group events by (chainKey, tokenAddress)
  type GroupKey = string; // `${chainKey}:${tokenAddress}`
  const groups = new Map<GroupKey, { events: TxEvent[]; symbol: string; chainKey: string }>();

  for (const ev of allEvents) {
    const key = `${ev.chainKey}:${ev.tokenAddress}`;
    if (!groups.has(key)) {
      groups.set(key, { events: [], symbol: ev.tokenSymbol, chainKey: ev.chainKey });
    }
    groups.get(key)!.events.push(ev);
  }

  // Resolve prices
  // 1) Native / well-known tokens: resolve by symbol → CoinGecko ID
  const symbols = [...new Set([...groups.values()].map((g) => g.symbol))];
  onProgress?.(`Fetching prices for ${symbols.length} tokens…`);

  const symbolToId: Record<string, string | null> = {};
  for (const sym of symbols) {
    symbolToId[sym] = await resolveSymbolToId(sym); // fast — KNOWN_IDS only, no API
  }
  const validIds = [...new Set(Object.values(symbolToId).filter(Boolean) as string[])];
  const nativePrices = validIds.length > 0 ? await getPrices(validIds) : {};

  // Current prices are resolved by canonical IDs only. Token filtering is address-based above.
  const currentPrices: Record<string, number> = { ...nativePrices };

  // CoinGecko's browser/free API is rate-limited. Fetch history only for ETH/WETH,
  // use the current price for stablecoins, and keep the range within the free window.
  const coinPriceHistory: Record<string, Record<string, number>> = {}; // coinId → { date → price }
  const uniqueCoinIds = [...new Set(Object.values(symbolToId).filter(Boolean) as string[])];
  const historySourceIds = [...new Set(uniqueCoinIds
    .filter((coinId) => !STABLE_COIN_IDS.has(coinId))
    .map(historySourceId))];
  if (historySourceIds.length > 0) {
    onProgress?.(`Fetching price history for ETH/WETH…`);
    const fromTs = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
    const toTs = Math.floor(Date.now() / 1000);
    for (const coinId of historySourceIds) {
      const history = await getCoinPriceHistoryRange(coinId, fromTs, toTs);
      if (history.length > 0) {
        coinPriceHistory[coinId] = Object.fromEntries(history.map((h) => [h.date, h.price]));
      }
    }
  }

  const holdings: TokenHolding[] = [];

  // Process each token group
  let processed = 0;
  for (const [, group] of groups) {
    const { events, symbol, chainKey } = group;
    const coinId = symbolToId[symbol];

    const resolvedCurrentPrice = coinId ? (currentPrices[coinId] ?? null) : null;

    const histPrices: Record<string, number> = coinId
      ? { ...(coinPriceHistory[historySourceId(coinId)] ?? {}) }
      : {};

    // Average cost basis tracking
    const costBasis: CostBasisEntry = { totalCost: 0, totalAmount: 0 };
    let realizedPnl = 0;
    let currentBalance = 0;

    // Process events in chronological order
    for (const ev of events) {
      if (ev.direction === 'in') {
        // Buy / receive — update cost basis
        const date = dayjs.unix(ev.timeStamp).format('YYYY-MM-DD');
        // Use historical price if available, else current price
        const price = histPrices[date] ?? resolvedCurrentPrice ?? 0;
        const cost = price * ev.amount;
        costBasis.totalCost += cost;
        costBasis.totalAmount += ev.amount;
        currentBalance += ev.amount;
      } else {
        // Sell / send
        if (currentBalance <= 0 || costBasis.totalAmount <= 0) {
          currentBalance = Math.max(0, currentBalance - ev.amount);
          continue;
        }
        const avgCost = costBasis.totalCost / costBasis.totalAmount;
        const date = dayjs.unix(ev.timeStamp).format('YYYY-MM-DD');
        const sellPrice = histPrices[date] ?? resolvedCurrentPrice ?? 0;
        const pnl = (sellPrice - avgCost) * Math.min(ev.amount, currentBalance);
        realizedPnl += pnl;

        // Reduce cost basis proportionally
        const ratio = Math.min(ev.amount / costBasis.totalAmount, 1);
        costBasis.totalCost *= 1 - ratio;
        costBasis.totalAmount -= Math.min(ev.amount, costBasis.totalAmount);
        currentBalance = Math.max(0, currentBalance - ev.amount);
      }
    }

    // Override balance with on-chain balance for native token
    let finalBalance = currentBalance;
    if (group.events[0]?.tokenAddress === 'native') {
      finalBalance = nativeBalanceByChain[chainKey] ?? currentBalance;
    }

    if (finalBalance < 0.000001 && realizedPnl === 0) continue;

    // Filter spam/scam tokens:
    // - no known price AND never paid for it (avg cost = 0) → airdrop spam
    // - name/symbol contains URL patterns or "Claim" → obvious scam
    const isSpam =
      (resolvedCurrentPrice === null && costBasis.totalCost === 0) ||
      /https?:\/\/|t\.ly\/|\.com\/|\.io\/|claim/i.test(symbol) ||
      /https?:\/\/|t\.ly\/|\.com\/|\.io\/|claim/i.test(group.events[0]?.tokenSymbol ?? '');
    if (isSpam) continue;

    const currentPriceUsd = resolvedCurrentPrice;
    const valueUsd = currentPriceUsd != null ? currentPriceUsd * finalBalance : null;
    const avgCostUsd = costBasis.totalAmount > 0 ? costBasis.totalCost / costBasis.totalAmount : null;
    const unrealizedPnlUsd =
      currentPriceUsd != null && avgCostUsd != null && finalBalance > 0
        ? (currentPriceUsd - avgCostUsd) * finalBalance
        : null;
    const totalPnlUsd =
      unrealizedPnlUsd != null ? realizedPnl + unrealizedPnlUsd : null;
    const invested = avgCostUsd != null ? avgCostUsd * finalBalance : null;
    const pnlPercent =
      totalPnlUsd != null && invested != null && invested > 0
        ? (totalPnlUsd / invested) * 100
        : null;

    holdings.push({
      address: group.events[0]?.tokenAddress ?? 'unknown',
      symbol,
      name: symbol,
      decimals: group.events[0]?.tokenDecimal ?? 18,
      balance: finalBalance,
      chainKey,
      priceUsd: currentPriceUsd,
      valueUsd,
      avgCostUsd,
      realizedPnlUsd: realizedPnl,
      unrealizedPnlUsd,
      totalPnlUsd,
      pnlPercent,
    });

    processed++;
    if (processed % 5 === 0) onProgress?.(`Processed ${processed} tokens…`);
  }

  // Summary
  const totalValueUsd = holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0);
  const realizedPnlUsd = holdings.reduce((s, h) => s + h.realizedPnlUsd, 0);
  const unrealizedPnlUsd = holdings.reduce((s, h) => s + (h.unrealizedPnlUsd ?? 0), 0);

  const byChain: Record<string, { valueUsd: number; pnlUsd: number }> = {};
  for (const h of holdings) {
    if (!byChain[h.chainKey]) byChain[h.chainKey] = { valueUsd: 0, pnlUsd: 0 };
    byChain[h.chainKey].valueUsd += h.valueUsd ?? 0;
    byChain[h.chainKey].pnlUsd += h.totalPnlUsd ?? 0;
  }

  // Sort by value desc
  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  return {
    holdings,
    summary: {
      totalValueUsd,
      realizedPnlUsd,
      unrealizedPnlUsd,
      totalPnlUsd: realizedPnlUsd + unrealizedPnlUsd,
      byChain,
    },
  };
}
