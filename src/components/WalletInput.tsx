import { useState } from 'react';
import { CHAIN_LIST } from '../lib/chains';
import { isValidAddress } from '../lib/utils';
import { getSavedWallets } from '../lib/storage';

interface Props {
  onSearch: (address: string, chains: string[]) => void;
  loading: boolean;
}

export function WalletInput({ onSearch, loading }: Props) {
  const saved = getSavedWallets();
  const [address, setAddress] = useState(() => saved[0] ?? '');
  const [selectedChains, setSelectedChains] = useState<string[]>(['base']);
  const [showHistory, setShowHistory] = useState(false);
  const valid = isValidAddress(address.trim());

  function toggleChain(key: string) {
    setSelectedChains((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    onSearch(address.trim(), selectedChains);
    setShowHistory(false);
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <form onSubmit={submit} className="relative flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={() => setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="0x… Paste a wallet address"
            className="w-full bg-[#18191d] border border-[#2a2b2f] rounded-xl px-4 py-3 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#0052FF] transition-colors"
            spellCheck={false}
            autoComplete="off"
          />
          {showHistory && saved.length > 0 && (
            <div className="absolute z-10 top-full mt-1 w-full bg-[#18191d] border border-[#2a2b2f] rounded-xl overflow-hidden shadow-xl">
              {saved.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-xs font-mono text-gray-400 hover:bg-[#222328] hover:text-gray-200 transition-colors"
                  onMouseDown={() => setAddress(w)}
                >
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!valid || loading}
          className="px-5 py-3 bg-[#0052FF] hover:bg-[#0047dd] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            'Track'
          )}
        </button>
      </form>

      {/* Chain toggles */}
      <div className="flex flex-wrap gap-2">
        {CHAIN_LIST.map((chain) => {
          const active = selectedChains.includes(chain.key);
          return (
            <button
              key={chain.key}
              onClick={() => toggleChain(chain.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={
                active
                  ? { backgroundColor: chain.color + '22', color: chain.color, border: `1px solid ${chain.color}88` }
                  : { backgroundColor: '#18191d', color: '#6b7280', border: '1px solid #2a2b2f' }
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: active ? chain.color : '#6b7280' }}
              />
              {chain.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
