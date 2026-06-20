import type { Chain } from '../types';

// Using Blockscout public APIs — no API key required, same Etherscan-compatible format
export const CHAINS: Record<string, Chain> = {
  base: {
    id: 8453,
    key: 'base',
    name: 'Base',
    symbol: 'ETH',
    explorerApi: 'https://base.blockscout.com/api',
    rpc: 'https://mainnet.base.org',
    color: '#0052FF',
    coingeckoNativeId: 'ethereum',
  },
  ethereum: {
    id: 1,
    key: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    explorerApi: 'https://eth.blockscout.com/api',
    rpc: 'https://eth.llamarpc.com',
    color: '#627EEA',
    coingeckoNativeId: 'ethereum',
  },
  polygon: {
    id: 137,
    key: 'polygon',
    name: 'Polygon',
    symbol: 'POL',
    explorerApi: 'https://polygon.blockscout.com/api',
    rpc: 'https://polygon.llamarpc.com',
    color: '#8247E5',
    coingeckoNativeId: 'matic-network',
  },
  arbitrum: {
    id: 42161,
    key: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    explorerApi: 'https://arbitrum.blockscout.com/api',
    rpc: 'https://arb1.arbitrum.io/rpc',
    color: '#28A0F0',
    coingeckoNativeId: 'ethereum',
  },
  optimism: {
    id: 10,
    key: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    explorerApi: 'https://optimism.blockscout.com/api',
    rpc: 'https://mainnet.optimism.io',
    color: '#FF0420',
    coingeckoNativeId: 'ethereum',
  },
};

export const CHAIN_LIST = Object.values(CHAINS);
