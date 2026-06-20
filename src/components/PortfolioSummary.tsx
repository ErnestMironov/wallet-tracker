import type { PnLSummary } from '../types';
import { formatUsd, formatPct, pnlColor } from '../lib/utils';
import { CHAINS } from '../lib/chains';

interface Props {
  summary: PnLSummary;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-gray-100">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

function PnLCard({ label, value }: { label: string; value: number }) {
  const color = pnlColor(value);
  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{formatUsd(value)}</span>
    </div>
  );
}

export function PortfolioSummary({ summary }: Props) {
  const activeChains = Object.entries(summary.byChain).filter(([, v]) => v.valueUsd > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Portfolio Value" value={formatUsd(summary.totalValueUsd)} />
        <PnLCard label="Total PnL" value={summary.totalPnlUsd} />
        <PnLCard label="Realized PnL" value={summary.realizedPnlUsd} />
        <PnLCard label="Unrealized PnL" value={summary.unrealizedPnlUsd} />
      </div>

      {activeChains.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeChains.map(([chainKey, data]) => {
            const chain = CHAINS[chainKey];
            if (!chain) return null;
            return (
              <div
                key={chainKey}
                className="flex items-center gap-2 bg-[#18191d] border border-[#2a2b2f] rounded-xl px-3 py-2 text-xs"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chain.color }} />
                <span className="text-gray-300">{chain.name}</span>
                <span className="text-gray-500">{formatUsd(data.valueUsd)}</span>
                <span className={pnlColor(data.pnlUsd)}>{formatUsd(data.pnlUsd)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
