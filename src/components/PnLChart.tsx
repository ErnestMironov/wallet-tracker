import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getCoinPriceHistory } from '../lib/api/coingecko';
import { formatUsd } from '../lib/utils';
import dayjs from 'dayjs';

interface Props {
  totalValueUsd: number;
  nativeBalance: number; // ETH amount on Base (used as proxy for chart)
}

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
] as const;

// Custom tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400">{label}</div>
      <div className="text-gray-100 font-semibold">{formatUsd(payload[0].value)}</div>
    </div>
  );
}

export function PnLChart({ totalValueUsd, nativeBalance }: Props) {
  const [data, setData] = useState<Array<{ date: string; value: number }>>([]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (totalValueUsd <= 0) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Use ETH price history as a proxy for portfolio chart shape
        const ethHistory = await getCoinPriceHistory('ethereum', period.days);
        if (cancelled) return;

        // Scale: last point of ETH history should represent current ETH portion of portfolio
        // This is a rough approximation — a full solution needs token-by-token history
        const lastEthPrice = ethHistory[ethHistory.length - 1]?.price ?? 1;
        const ethValue = lastEthPrice * nativeBalance;
        const scale = totalValueUsd > 0 ? totalValueUsd / Math.max(ethValue, 1) : 1;

        const points = ethHistory.map((p) => ({
          date: dayjs(p.date).format('MMM D'),
          value: p.price * nativeBalance * scale,
        }));

        setData(points);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [period, totalValueUsd, nativeBalance]);

  const isUp = data.length >= 2 && data[data.length - 1].value >= data[0].value;
  const color = isUp ? '#22c55e' : '#ef4444';

  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Portfolio Value</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period.label === p.label
                  ? 'bg-[#0052FF22] text-[#0052FF] border border-[#0052FF44]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-gray-600">Loading chart…</div>
          </div>
        )}
        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1f23" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatUsd(v, 0)}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill="url(#pnlGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!loading && data.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-gray-600">
            No chart data available
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        Chart uses ETH price history as portfolio shape approximation. Exact per-token history requires historical price fetching.
      </p>
    </div>
  );
}
