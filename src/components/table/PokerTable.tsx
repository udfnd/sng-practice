import type { Card } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';

interface PokerTableProps {
  communityCards: Card[];
  potAmount: number;
}

export function PokerTable({ communityCards, potAmount }: PokerTableProps) {
  return (
    <div className="absolute inset-8 rounded-[50%] bg-felt border-4 border-felt-dark shadow-inner flex flex-col items-center justify-center gap-2">
      {/* Community Cards */}
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => {
          const card = communityCards[i];
          return card ? (
            <PlayingCard key={i} card={card} size="md" />
          ) : (
            <div key={i} className="w-12 h-16 rounded border border-felt-dark/50 bg-felt-dark/30" />
          );
        })}
      </div>
      {/* Pot */}
      {potAmount > 0 && (
        <div className="text-white font-bold text-sm bg-black/40 px-3 py-1 rounded-full">
          Pot: {formatChips(potAmount)}
        </div>
      )}
    </div>
  );
}

function formatChips(amount: number): string {
  if (amount >= 10000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString();
}
