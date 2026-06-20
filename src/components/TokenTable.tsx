import type { TokenHolding } from '../types';
import { formatUsd, formatAmount, formatPct, pnlColor } from '../lib/utils';
import { ChainBadge } from './ChainBadge';

interface Props {
  holdings: TokenHolding[];
}

function TokenLogo({ symbol }: { symbol: string }) {
  const letter = (symbol[0] ?? '?').toUpperCase();
  const hue = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ background: `hsl(${hue}, 60%, 35%)` }}
    >
      {letter}
    </div>
  );
}

export function TokenTable({ holdings }: Props) {
  if (holdings.length === 0) {
    return (
      <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-8 text-center text-sm text-gray-600">
        No token holdings found
      </div>
    );
  }

  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2b2f]">
        <h2 className="text-sm font-semibold text-gray-200">Holdings</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] text-gray-600 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Token</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-right px-4 py-3">Avg Cost</th>
              <th className="text-right px-4 py-3">Realized</th>
              <th className="text-right px-4 py-3">Unrealized</th>
              <th className="text-right px-5 py-3">Total PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1f23]">
            {holdings.map((h, i) => (
              <tr key={`${h.chainKey}-${h.address}-${i}`} className="hover:bg-[#1a1b1f] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <TokenLogo symbol={h.symbol} />
                    <div>
                      <div className="font-medium text-gray-200">{h.symbol}</div>
                      <ChainBadge chainKey={h.chainKey} small />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {formatAmount(h.balance)}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  {h.priceUsd != null ? formatUsd(h.priceUsd) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-200">
                  {h.valueUsd != null ? formatUsd(h.valueUsd) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {h.avgCostUsd != null ? formatUsd(h.avgCostUsd) : '—'}
                </td>
                <td className={`px-4 py-3 text-right ${pnlColor(h.realizedPnlUsd)}`}>
                  {formatUsd(h.realizedPnlUsd)}
                </td>
                <td className={`px-4 py-3 text-right ${pnlColor(h.unrealizedPnlUsd)}`}>
                  {h.unrealizedPnlUsd != null ? formatUsd(h.unrealizedPnlUsd) : '—'}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className={`font-semibold ${pnlColor(h.totalPnlUsd)}`}>
                    {h.totalPnlUsd != null ? formatUsd(h.totalPnlUsd) : '—'}
                  </div>
                  {h.pnlPercent != null && (
                    <div className={`text-[11px] ${pnlColor(h.pnlPercent)}`}>
                      {formatPct(h.pnlPercent)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
