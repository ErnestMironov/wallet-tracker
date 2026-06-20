import type { ApiKeys } from '../types';

const KEYS_KEY = 'wt_api_keys';
const WALLETS_KEY = 'wt_wallets';

const DEFAULT_KEYS: ApiKeys = {
  etherscan: '',
  basescan: '',
  polygonscan: '',
  arbiscan: '',
  optimism: '',
};

export function getApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    if (!raw) return { ...DEFAULT_KEYS };
    return { ...DEFAULT_KEYS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_KEYS };
  }
}

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
}

export function getApiKeyForChain(chainKey: string): string {
  const keys = getApiKeys();
  const map: Record<string, keyof ApiKeys> = {
    ethereum: 'etherscan',
    base: 'basescan',
    polygon: 'polygonscan',
    arbitrum: 'arbiscan',
    optimism: 'optimism',
  };
  return keys[map[chainKey] ?? 'etherscan'] ?? '';
}

export function getSavedWallets(): string[] {
  try {
    const raw = localStorage.getItem(WALLETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWallet(address: string): void {
  const existing = getSavedWallets();
  if (!existing.includes(address.toLowerCase())) {
    const updated = [address.toLowerCase(), ...existing].slice(0, 10);
    localStorage.setItem(WALLETS_KEY, JSON.stringify(updated));
  }
}
