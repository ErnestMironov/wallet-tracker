import { CHAINS } from '../lib/chains';

interface Props {
  chainKey: string;
  small?: boolean;
}

export function ChainBadge({ chainKey, small }: Props) {
  const chain = CHAINS[chainKey];
  if (!chain) return <span className="text-xs text-gray-500">{chainKey}</span>;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: chain.color + '22', color: chain.color, border: `1px solid ${chain.color}44` }}
    >
      {chain.name}
    </span>
  );
}
