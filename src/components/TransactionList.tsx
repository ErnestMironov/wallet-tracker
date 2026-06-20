import type { TokenTransfer, NativeTx } from '../types';
import { ChainBadge } from './ChainBadge';
import { formatAmount, shortAddr } from '../lib/utils';
import { CHAINS } from '../lib/chains';
import dayjs from 'dayjs';

interface Props {
  erc20ByChain: Record<string, TokenTransfer[]>;
  nativeByChain: Record<string, NativeTx[]>;
}

type AnyTx =
  | (TokenTransfer & { kind: 'erc20' })
  | (NativeTx & { kind: 'native'; symbol: string });

export function TransactionList({ erc20ByChain, nativeByChain }: Props) {
  const all: AnyTx[] = [];

  for (const [, txs] of Object.entries(erc20ByChain)) {
    for (const tx of txs) all.push({ ...tx, kind: 'erc20' });
  }
  for (const [chainKey, txs] of Object.entries(nativeByChain)) {
    const symbol = CHAINS[chainKey]?.symbol ?? 'ETH';
    for (const tx of txs) {
      if (!tx.isError) all.push({ ...tx, kind: 'native', symbol });
    }
  }

  all.sort((a, b) => b.timeStamp - a.timeStamp);
  const recent = all.slice(0, 100);

  if (recent.length === 0) {
    return (
      <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-8 text-center text-sm text-gray-600">
        No transactions found
      </div>
    );
  }

  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2b2f]">
        <h2 className="text-sm font-semibold text-gray-200">
          Recent Transactions <span className="text-gray-600 font-normal">({recent.length})</span>
        </h2>
      </div>
      <div className="divide-y divide-[#1e1f23]">
        {recent.map((tx) => {
          const isIn = tx.direction === 'in';
          const symbol = tx.kind === 'erc20' ? tx.tokenSymbol : tx.symbol;
          const amount = tx.valueFormatted;
          const date = dayjs.unix(tx.timeStamp).format('MMM D, YYYY · HH:mm');
          const explorerBase = CHAINS[tx.chainKey]?.explorerApi.replace('/api', '') ?? '';
          const txUrl = explorerBase ? `${explorerBase}/tx/${tx.hash}` : undefined;

          return (
            <div key={tx.hash + tx.chainKey} className="px-5 py-3 flex items-center gap-3 hover:bg-[#1a1b1f] transition-colors">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isIn
                    ? 'bg-green-400/10 text-green-400'
                    : 'bg-red-400/10 text-red-400'
                }`}
              >
                {isIn ? '↓' : '↑'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">
                    {isIn ? '+' : '-'}{formatAmount(amount)} {symbol}
                  </span>
                  <ChainBadge chainKey={tx.chainKey} small />
                </div>
                <div className="text-xs text-gray-600">
                  {isIn ? 'From' : 'To'} {shortAddr(isIn ? tx.from : tx.to)} · {date}
                </div>
              </div>
              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-gray-400 shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
