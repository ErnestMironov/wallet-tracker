import { useState, useEffect } from 'react';
import { WalletInput } from './components/WalletInput';
import { PortfolioSummary } from './components/PortfolioSummary';
import { PnLChart } from './components/PnLChart';
import { TokenTable } from './components/TokenTable';
import { TransactionList } from './components/TransactionList';
import { ProfitCalculator } from './components/ProfitCalculator';
import { Settings } from './components/Settings';
import { shortAddr } from './lib/utils';
import { getERC20Transfers, getNativeTxs, getNativeBalance } from './lib/api/explorer';
import { computeHoldings } from './lib/pnl';
import { saveWallet, getSavedWallets } from './lib/storage';
import { CHAINS } from './lib/chains';
import type { TokenTransfer, NativeTx, TokenHolding, PnLSummary } from './types';

type Tab = 'holdings' | 'calculator' | 'transactions';

interface TrackerState {
  address: string;
  chains: string[];
  holdings: TokenHolding[];
  summary: PnLSummary;
  erc20ByChain: Record<string, TokenTransfer[]>;
  nativeByChain: Record<string, NativeTx[]>;
  nativeBalanceByChain: Record<string, number>;
}

export default function App() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TrackerState | null>(null);
  const [tab, setTab] = useState<Tab>('holdings');
  const [showSettings, setShowSettings] = useState(false);

  // Auto-load last used wallet on startup
  useEffect(() => {
    const saved = getSavedWallets();
    if (saved.length > 0) {
      handleSearch(saved[0], ['base']);
    }
  }, []);

  async function handleSearch(address: string, chains: string[]) {
    setLoading(true);
    setError(null);
    setProgress('Fetching on-chain data…');

    try {
      const erc20ByChain: Record<string, TokenTransfer[]> = {};
      const nativeByChain: Record<string, NativeTx[]> = {};
      const nativeBalanceByChain: Record<string, number> = {};
      const nativeSymbolByChain: Record<string, string> = {};

      for (const chainKey of chains) {
        const chain = CHAINS[chainKey];
        if (!chain) continue;
        setProgress(`Fetching ${chain.name} transactions…`);
        try {
          const [erc20, native, nativeBal] = await Promise.all([
            getERC20Transfers(chainKey, address),
            getNativeTxs(chainKey, address),
            getNativeBalance(chainKey, address),
          ]);
          erc20ByChain[chainKey] = erc20;
          nativeByChain[chainKey] = native;
          nativeBalanceByChain[chainKey] = nativeBal;
          nativeSymbolByChain[chainKey] = chain.symbol;
        } catch (err) {
          console.warn(`Failed to fetch ${chainKey}:`, err);
          erc20ByChain[chainKey] = [];
          nativeByChain[chainKey] = [];
          nativeBalanceByChain[chainKey] = 0;
          nativeSymbolByChain[chainKey] = chain.symbol;
        }
      }

      setProgress('Computing PnL…');

      const { holdings, summary } = await computeHoldings(
        erc20ByChain,
        nativeByChain,
        nativeBalanceByChain,
        nativeSymbolByChain,
        (msg) => setProgress(msg),
      );

      saveWallet(address);

      setState({
        address,
        chains,
        holdings,
        summary,
        erc20ByChain,
        nativeByChain,
        nativeBalanceByChain,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0e11] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1e1f23] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0052FF] flex items-center justify-center text-white font-bold text-sm">
            W
          </div>
          <span className="font-semibold text-gray-100">Wallet Tracker</span>
          {state && (
            <span className="text-xs text-gray-500 font-mono">{shortAddr(state.address)}</span>
          )}
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-[#18191d] border border-transparent hover:border-[#2a2b2f] transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          API Keys
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <WalletInput onSearch={handleSearch} loading={loading} />

        {/* Loading state */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4 text-[#0052FF]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {progress}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        {state && !loading && (
          <>
            <PortfolioSummary summary={state.summary} />
            <PnLChart totalValueUsd={state.summary.totalValueUsd} />

            {/* Tabs */}
            <div className="flex gap-1 bg-[#18191d] border border-[#2a2b2f] rounded-xl p-1 w-fit">
              {([
                { key: 'holdings', label: 'Holdings' },
                { key: 'calculator', label: '📈 Calculator' },
                { key: 'transactions', label: 'Transactions' },
              ] as { key: Tab; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === key ? 'bg-[#222328] text-gray-100' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'holdings' && <TokenTable holdings={state.holdings} />}
            {tab === 'calculator' && <ProfitCalculator holdings={state.holdings} />}
            {tab === 'transactions' && (
              <TransactionList
                erc20ByChain={state.erc20ByChain}
                nativeByChain={state.nativeByChain}
              />
            )}
          </>
        )}

        {/* Empty state */}
        {!state && !loading && (
          <div className="text-center py-20 space-y-3">
            <div className="text-5xl">🦆</div>
            <p className="text-gray-600 text-sm">
              Paste any EVM wallet address to track its portfolio and PnL across chains
            </p>
            <p className="text-gray-700 text-xs">
              Base · Ethereum · Polygon · Arbitrum · Optimism
            </p>
          </div>
        )}
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
