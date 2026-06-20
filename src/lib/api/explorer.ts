import type { TokenTransfer, NativeTx } from '../../types';
import { CHAINS } from '../chains';
import { getApiKeyForChain } from '../storage';
import { formatTokenValue } from '../utils';

async function explorerFetch(chainKey: string, params: Record<string, string>): Promise<unknown> {
  const chain = CHAINS[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);

  const apiKey = getApiKeyForChain(chainKey);
  const url = new URL(chain.explorerApi);
  url.search = new URLSearchParams({
    ...params,
    ...(apiKey ? { apikey: apiKey } : {}),
  }).toString();

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Explorer API error ${res.status}`);
  const json = (await res.json()) as { status: string; message: string; result: unknown };

  if (json.status === '0') {
    // Empty result is not an error — Blockscout and Etherscan phrase this differently
    if (Array.isArray(json.result) && json.result.length === 0) return [];
    const msg = (json.message ?? '').toLowerCase();
    const result = typeof json.result === 'string' ? json.result.toLowerCase() : '';
    if (
      msg.includes('no transactions') ||
      msg.includes('no record') ||
      msg.includes('no result') ||
      msg.includes('not found') ||
      result.includes('no transactions found') ||
      result.includes('no record found')
    ) {
      return [];
    }
    // Rate-limit / auth errors — surface them but don't crash the whole run
    console.warn(`Explorer API status=0 on ${chainKey}:`, json.message, json.result);
    return [];
  }
  return json.result;
}

export async function getERC20Transfers(
  chainKey: string,
  address: string,
): Promise<TokenTransfer[]> {
  const raw = (await explorerFetch(chainKey, {
    module: 'account',
    action: 'tokentx',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    offset: '10000',
    page: '1',
  })) as Array<Record<string, string>>;

  if (!Array.isArray(raw)) return [];

  const walletLower = address.toLowerCase();

  return raw.map((tx) => {
    const decimals = Number(tx.tokenDecimal ?? 18);
    const valueFormatted = formatTokenValue(tx.value, decimals);
    const direction = tx.to.toLowerCase() === walletLower ? 'in' : 'out';
    return {
      hash: tx.hash,
      blockNumber: Number(tx.blockNumber),
      timeStamp: Number(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      tokenAddress: tx.contractAddress.toLowerCase(),
      tokenName: tx.tokenName,
      tokenSymbol: tx.tokenSymbol,
      tokenDecimal: decimals,
      value: BigInt(tx.value),
      valueFormatted,
      direction,
      chainKey,
    } satisfies TokenTransfer;
  });
}

export async function getNativeTxs(
  chainKey: string,
  address: string,
): Promise<NativeTx[]> {
  const raw = (await explorerFetch(chainKey, {
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    sort: 'desc',
    offset: '10000',
    page: '1',
  })) as Array<Record<string, string>>;

  if (!Array.isArray(raw)) return [];

  const walletLower = address.toLowerCase();

  return raw
    .filter((tx) => tx.value !== '0')
    .map((tx) => {
      const valueFormatted = formatTokenValue(tx.value, 18);
      const direction = tx.to.toLowerCase() === walletLower ? 'in' : 'out';
      return {
        hash: tx.hash,
        blockNumber: Number(tx.blockNumber),
        timeStamp: Number(tx.timeStamp),
        from: tx.from,
        to: tx.to,
        value: BigInt(tx.value),
        valueFormatted,
        direction,
        isError: tx.isError === '1',
        chainKey,
      } satisfies NativeTx;
    });
}

export async function getTokenBalances(
  chainKey: string,
  address: string,
): Promise<Array<{ tokenAddress: string; tokenSymbol: string; tokenName: string; tokenDecimal: number; balance: number }>> {
  // Use tokentx to infer balances — sum up all transfers
  const transfers = await getERC20Transfers(chainKey, address);

  const balanceMap: Record<
    string,
    { tokenAddress: string; tokenSymbol: string; tokenName: string; tokenDecimal: number; balance: number }
  > = {};

  for (const tx of transfers) {
    const key = tx.tokenAddress;
    if (!balanceMap[key]) {
      balanceMap[key] = {
        tokenAddress: key,
        tokenSymbol: tx.tokenSymbol,
        tokenName: tx.tokenName,
        tokenDecimal: tx.tokenDecimal,
        balance: 0,
      };
    }
    if (tx.direction === 'in') {
      balanceMap[key].balance += tx.valueFormatted;
    } else {
      balanceMap[key].balance -= tx.valueFormatted;
    }
  }

  return Object.values(balanceMap).filter((b) => b.balance > 0.000001);
}

export async function getNativeBalance(chainKey: string, address: string): Promise<number> {
  const raw = (await explorerFetch(chainKey, {
    module: 'account',
    action: 'balance',
    address,
    tag: 'latest',
  })) as string;
  if (typeof raw !== 'string') return 0;
  return formatTokenValue(raw, 18);
}
