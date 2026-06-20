export interface Chain {
  id: number;
  key: string;
  name: string;
  symbol: string;
  explorerApi: string;
  rpc: string;
  color: string;
  coingeckoNativeId: string;
}

export interface TokenTransfer {
  hash: string;
  blockNumber: number;
  timeStamp: number; // unix seconds
  from: string;
  to: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: number;
  value: bigint; // raw
  valueFormatted: number;
  direction: 'in' | 'out';
  chainKey: string;
}

export interface NativeTx {
  hash: string;
  blockNumber: number;
  timeStamp: number;
  from: string;
  to: string;
  value: bigint;
  valueFormatted: number;
  direction: 'in' | 'out';
  isError: boolean;
  chainKey: string;
}

export interface TokenHolding {
  address: string; // token contract address or 'native'
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  chainKey: string;
  // populated after price fetch
  priceUsd: number | null;
  valueUsd: number | null;
  // PnL
  avgCostUsd: number | null;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number | null;
  totalPnlUsd: number | null;
  pnlPercent: number | null;
}

export interface PnLSummary {
  totalValueUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  totalPnlUsd: number;
  byChain: Record<string, { valueUsd: number; pnlUsd: number }>;
}

export interface PortfolioPoint {
  date: string; // YYYY-MM-DD
  valueUsd: number;
}

export interface ApiKeys {
  etherscan: string;
  basescan: string;
  polygonscan: string;
  arbiscan: string;
  optimism: string;
}
