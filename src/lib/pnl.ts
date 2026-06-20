import type { TokenTransfer, NativeTx, TokenHolding, PnLSummary } from '../types';
import { resolveSymbolToId, getPrices, getHistoricalPrice, getTokenPricesByAddress, getCoinPriceHistoryRange } from './api/coingecko';
import { sleep } from './utils';
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
    allEvents.push(...transfersToEvents(transfers, native, chainKey, symbol));
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

  // 2) ERC-20 tokens: batch-fetch by contract address per chain (one API call per chain)
  const addressPricesByChain: Record<string, Record<string, number>> = {};
  const chainKeys = [...new Set([...groups.keys()].map((k) => k.split(':')[0]))];
  for (const chainKey of chainKeys) {
    const addrs = [...groups.entries()]
      .filter(([k]) => k.startsWith(chainKey + ':'))
      .map(([k]) => k.split(':')[1])
      .filter((a) => a !== 'native');
    if (addrs.length > 0) {
      onProgress?.(`Fetching ${addrs.length} token prices on ${chainKey}…`);
      addressPricesByChain[chainKey] = await getTokenPricesByAddress(chainKey, addrs);
    }
  }

  // Merge: address-based prices take priority, then native/known-symbol prices
  const currentPrices: Record<string, number> = { ...nativePrices };

  // Pre-fetch full price history for all known coin IDs — one API call each
  // Use range endpoint (no day-count limit on free tier) from Jan 1 2024 → now
  const coinPriceHistory: Record<string, Record<string, number>> = {}; // coinId → { date → price }
  const uniqueCoinIds = [...new Set(Object.values(symbolToId).filter(Boolean) as string[])];
  if (uniqueCoinIds.length > 0) {
    onProgress?.(`Fetching price history for ${uniqueCoinIds.length} tokens…`);
    const fromTs = Math.floor(new Date('2023-01-01').getTime() / 1000);
    const toTs = Math.floor(Date.now() / 1000);
    for (const coinId of uniqueCoinIds) {
      const history = await getCoinPriceHistoryRange(coinId, fromTs, toTs);
      if (history.length > 0) {
        coinPriceHistory[coinId] = Object.fromEntries(history.map((h) => [h.date, h.price]));
      }
      await sleep(300);
    }
  }

  const holdings: TokenHolding[] = [];

  // Process each token group
  let processed = 0;
  for (const [groupKey, group] of groups) {
    const { events, symbol, chainKey } = group;
    const coinId = symbolToId[symbol];
    const tokenAddress = groupKey.split(':')[1]; // may be 'native'

    // Resolve current price: by address first, then by known coin ID
    const addrPrice = tokenAddress !== 'native'
      ? (addressPricesByChain[chainKey]?.[tokenAddress.toLowerCase()] ?? null)
      : null;
    const resolvedCurrentPrice = addrPrice ?? (coinId ? (currentPrices[coinId] ?? null) : null);

    // Build historical price lookup: daily chart first, then fall back to per-date API
    // This covers both BUY and SELL dates for accurate PnL calculation
    const histPrices: Record<string, number> = coinId ? { ...(coinPriceHistory[coinId] ?? {}) } : {};

    // For sell dates not covered by the 365-day chart, fall back to per-date lookup
    const coveredDates = new Set(Object.keys(histPrices));
    const missingSellDates: string[] = [];
    for (const ev of events) {
      if (ev.direction === 'out') {
        const date = dayjs.unix(ev.timeStamp).format('YYYY-MM-DD');
        if (!coveredDates.has(date) && coinId) missingSellDates.push(date);
      }
    }
    if (missingSellDates.length > 0 && coinId) {
      for (const date of missingSellDates) {
        const p = await getHistoricalPrice(coinId, date);
        if (p != null) histPrices[date] = p;
        await sleep(200);
      }
    }

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
