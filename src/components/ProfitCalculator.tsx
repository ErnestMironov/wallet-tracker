import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TokenHolding } from '../types';

interface Props {
  holdings: TokenHolding[];
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsd(n: number) {
  if (Math.abs(n) >= 1000) return '$' + fmt(n, 0);
  return '$' + fmt(n, 2);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pnl = d.pnl;
  const isPos = pnl >= 0;
  return (
    <div className="bg-[#1e1f23] border border-[#2a2b2f] rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="text-gray-400 mb-1">Price: <span className="text-gray-200 font-mono">${fmt(label)}</span></div>
      <div className={isPos ? 'text-green-400' : 'text-red-400'}>
        PnL: {isPos ? '+' : ''}{fmtUsd(pnl)} ({isPos ? '+' : ''}{fmt(d.pct, 1)}%)
      </div>
      <div className="text-gray-500 mt-0.5">Value: {fmtUsd(d.value)}</div>
    </div>
  );
};

export function ProfitCalculator({ holdings }: Props) {
  const eligible = holdings.filter(
    (h) => h.balance > 0 && h.avgCostUsd != null && h.priceUsd != null,
  );

  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    eligible[0]?.symbol ?? '',
  );
  const [targetPriceInput, setTargetPriceInput] = useState('');

  const token = eligible.find((h) => h.symbol === selectedSymbol) ?? eligible[0];

  const currentPrice = token?.priceUsd ?? 0;
  const avgCost = token?.avgCostUsd ?? 0;
  const balance = token?.balance ?? 0;
  const totalCostBasis = avgCost * balance;

  const targetPrice = parseFloat(targetPriceInput) || currentPrice;

  // Build chart data: range from 0.2× to 3× current price (or avg cost if higher)
  const chartData = useMemo(() => {
    if (!token) return [];
    const base = Math.max(currentPrice, avgCost);
    const low = base * 0.1;
    const high = base * 3;
    const steps = 80;
    const step = (high - low) / steps;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const price = low + i * step;
      const value = price * balance;
      const pnl = (price - avgCost) * balance;
      const pct = totalCostBasis > 0 ? (pnl / totalCostBasis) * 100 : 0;
      points.push({ price: parseFloat(price.toFixed(6)), value, pnl, pct });
    }
    return points;
  }, [token, currentPrice, avgCost, balance, totalCostBasis]);

  // Metrics at target price
  const targetValue = targetPrice * balance;
  const targetPnl = (targetPrice - avgCost) * balance;
  const targetPct = totalCostBasis > 0 ? (targetPnl / totalCostBasis) * 100 : 0;
  const breakeven = avgCost;
  const changeFromCurrent = ((targetPrice - currentPrice) / currentPrice) * 100;

  if (eligible.length === 0) {
    return (
      <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl p-8 text-center text-sm text-gray-600">
        No holdings with price data available
      </div>
    );
  }

  return (
    <div className="bg-[#18191d] border border-[#2a2b2f] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#2a2b2f] flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-200 shrink-0">Profit Calculator</h2>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Token selector */}
          <select
            value={selectedSymbol}
            onChange={(e) => {
              setSelectedSymbol(e.target.value);
              setTargetPriceInput('');
            }}
            className="bg-[#111214] border border-[#2a2b2f] rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#0052FF] cursor-pointer"
          >
            {eligible.map((h) => (
              <option key={h.symbol + h.chainKey} value={h.symbol}>
                {h.symbol} ({h.balance < 0.001 ? h.balance.toExponential(2) : fmt(h.balance, 4)})
              </option>
            ))}
          </select>

          {/* Target price input */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Sell at $</span>
            <input
              type="number"
              min="0"
              step="any"
              placeholder={fmt(currentPrice)}
              value={targetPriceInput}
              onChange={(e) => setTargetPriceInput(e.target.value)}
              className="w-28 bg-[#111214] border border-[#2a2b2f] rounded-lg px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-700 focus:outline-none focus:border-[#0052FF]"
            />
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#2a2b2f]">
        {[
          {
            label: 'At Target',
            value: fmtUsd(targetValue),
            sub: `${fmt(balance, 4)} ${token?.symbol}`,
            neutral: true,
          },
          {
            label: 'PnL at Target',
            value: (targetPnl >= 0 ? '+' : '') + fmtUsd(targetPnl),
            sub: (targetPct >= 0 ? '+' : '') + fmt(targetPct, 1) + '%',
            positive: targetPnl >= 0,
          },
          {
            label: 'Breakeven',
            value: fmtUsd(breakeven),
            sub: `avg cost / token`,
            neutral: true,
          },
          {
            label: 'Price change',
            value: (changeFromCurrent >= 0 ? '+' : '') + fmt(changeFromCurrent, 1) + '%',
            sub: `vs current $${fmt(currentPrice)}`,
            positive: changeFromCurrent >= 0,
            negative: changeFromCurrent < 0,
          },
        ].map(({ label, value, sub, positive, negative, neutral }) => (
          <div key={label} className="bg-[#18191d] px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-gray-600 mb-1">{label}</div>
            <div
              className={`text-base font-semibold ${
                neutral
                  ? 'text-gray-200'
                  : positive
                  ? 'text-green-400'
                  : negative
                  ? 'text-red-400'
                  : 'text-gray-200'
              }`}
            >
              {value}
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="px-4 pt-4 pb-5">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1f23" />
            <XAxis
              dataKey="price"
              tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : fmt(v, v < 1 ? 4 : 0))}
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={{ stroke: '#2a2b2f' }}
              tickLine={false}
              minTickGap={50}
            />
            <YAxis
              tickFormatter={(v) =>
                v >= 1000
                  ? '+$' + (v / 1000).toFixed(0) + 'k'
                  : v <= -1000
                  ? '-$' + (Math.abs(v) / 1000).toFixed(0) + 'k'
                  : (v >= 0 ? '+$' : '-$') + Math.abs(v).toFixed(0)
              }
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Zero PnL line */}
            <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />

            {/* Breakeven price */}
            <ReferenceLine
              x={parseFloat(breakeven.toFixed(6))}
              stroke="#6b7280"
              strokeDasharray="4 2"
              label={{ value: 'BE', fill: '#6b7280', fontSize: 9, position: 'insideTopRight' }}
            />

            {/* Current price */}
            <ReferenceLine
              x={parseFloat(currentPrice.toFixed(6))}
              stroke="#3b82f6"
              strokeDasharray="4 2"
              label={{ value: 'NOW', fill: '#3b82f6', fontSize: 9, position: 'insideTopRight' }}
            />

            {/* Target price */}
            {targetPriceInput && (
              <ReferenceLine
                x={parseFloat(targetPrice.toFixed(6))}
                stroke={targetPnl >= 0 ? '#34d399' : '#f87171'}
                strokeWidth={1.5}
                label={{
                  value: 'TARGET',
                  fill: targetPnl >= 0 ? '#34d399' : '#f87171',
                  fontSize: 9,
                  position: 'insideTopLeft',
                }}
              />
            )}

            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#0052FF"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#0052FF', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center text-[10px] text-gray-600">
          <span><span className="inline-block w-3 h-px bg-gray-500 align-middle mr-1" style={{display:'inline-block',height:'1px',width:'12px',background:'#6b7280',verticalAlign:'middle',marginRight:'4px'}}></span>Breakeven</span>
          <span><span style={{display:'inline-block',height:'1px',width:'12px',background:'#3b82f6',verticalAlign:'middle',marginRight:'4px'}}></span>Current</span>
          {targetPriceInput && <span><span style={{display:'inline-block',height:'1px',width:'12px',background: targetPnl >= 0 ? '#34d399' : '#f87171',verticalAlign:'middle',marginRight:'4px'}}></span>Target</span>}
        </div>
      </div>
    </div>
  );
}
