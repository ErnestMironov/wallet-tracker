export interface TrackedToken {
  address: string;
  symbol: 'WETH' | 'USDC' | 'USDT';
  decimals: number;
}

export const TRACKED_ERC20: Record<string, TrackedToken[]> = {
  base: [
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6 },
    { address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', symbol: 'USDC', decimals: 6 },
    { address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', symbol: 'USDT', decimals: 6 },
  ],
  ethereum: [
    { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18 },
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6 },
    { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6 },
  ],
  polygon: [
    { address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619', symbol: 'WETH', decimals: 18 },
    { address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', symbol: 'USDC', decimals: 6 },
    { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC', decimals: 6 },
    { address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', symbol: 'USDT', decimals: 6 },
  ],
  arbitrum: [
    { address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', symbol: 'WETH', decimals: 18 },
    { address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', symbol: 'USDC', decimals: 6 },
    { address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', symbol: 'USDC', decimals: 6 },
    { address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', symbol: 'USDT', decimals: 6 },
  ],
  optimism: [
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    { address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', symbol: 'USDC', decimals: 6 },
    { address: '0x7f5c764cbc14f9669b88837ca1490cca17c31607', symbol: 'USDC', decimals: 6 },
    { address: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', symbol: 'USDT', decimals: 6 },
  ],
};

export function getTrackedTokenByAddress(
  chainKey: string,
  address: string,
): TrackedToken | null {
  const lower = address.toLowerCase();
  return TRACKED_ERC20[chainKey]?.find((token) => token.address === lower) ?? null;
}
