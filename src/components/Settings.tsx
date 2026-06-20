import { useState } from 'react';
import { getApiKeys, saveApiKeys } from '../lib/storage';
import type { ApiKeys } from '../types';

interface Props {
  onClose: () => void;
}

const FIELDS: Array<{ key: keyof ApiKeys; label: string; link: string; chain: string }> = [
  { key: 'basescan', label: 'Basescan API Key', link: 'https://basescan.org/myapikey', chain: 'Base' },
  { key: 'etherscan', label: 'Etherscan API Key', link: 'https://etherscan.io/myapikey', chain: 'Ethereum' },
  { key: 'polygonscan', label: 'Polygonscan API Key', link: 'https://polygonscan.com/myapikey', chain: 'Polygon' },
  { key: 'arbiscan', label: 'Arbiscan API Key', link: 'https://arbiscan.io/myapikey', chain: 'Arbitrum' },
  { key: 'optimism', label: 'Optimistic Etherscan Key', link: 'https://optimistic.etherscan.io/myapikey', chain: 'Optimism' },
];

export function Settings({ onClose }: Props) {
  const [keys, setKeys] = useState<ApiKeys>(getApiKeys);

  function handleSave() {
    saveApiKeys(keys);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#18191d] border border-[#2a2b2f] rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2b2f]">
          <h2 className="font-semibold text-gray-100">API Keys</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500">
            Приложение использует <span className="text-gray-400">Blockscout</span> — публичный API без ключей. Ключи нужны только если хочешь переключиться на Etherscan/Basescan (быстрее, но требует регистрации).
          </p>

          {FIELDS.map(({ key, label, link, chain }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400">{label}</label>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#0052FF] hover:text-[#4080ff]"
                >
                  Get {chain} key →
                </a>
              </div>
              <input
                type="text"
                value={keys[key]}
                onChange={(e) => setKeys((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="YourApiKeyHere"
                className="w-full bg-[#111214] border border-[#2a2b2f] rounded-xl px-3 py-2 text-xs font-mono text-gray-300 placeholder-gray-700 focus:outline-none focus:border-[#0052FF] transition-colors"
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#2a2b2f] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-sm bg-[#0052FF] hover:bg-[#0047dd] text-white font-medium transition-colors"
          >
            Save Keys
          </button>
        </div>
      </div>
    </div>
  );
}
