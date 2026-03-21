import { memo } from 'react';
import type { Card } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';

interface PokerTableProps {
  communityCards: Card[];
  potAmount: number;
}

export const PokerTable = memo(function PokerTable({
  communityCards,
  potAmount,
}: PokerTableProps) {
  return (
    <div className="absolute inset-8 rounded-[50%] bg-felt border-4 border-felt-dark shadow-inner flex flex-col items-center justify-center gap-2">
      {/* Community Cards */}
      <div className="flex gap-1 sm:gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const card = communityCards[i];
          return card ? (
            <div key={`${card.encoded}-${i}`} className="transition-opacity duration-300">
              <PlayingCard card={card} size="md" animate />
            </div>
          ) : (
            <div
              key={i}
              className="w-16 h-[90px] rounded border border-felt-dark/50 bg-felt-dark/30 opacity-40"
            />
          );
        })}
      </div>

      {/* Pot */}
      <div
        className={`text-white font-bold text-sm bg-black/40 px-3 py-1 rounded-full transition-all duration-300 ${
          potAmount > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        Pot: {formatChips(potAmount)}
      </div>
    </div>
  );
});

function formatChips(amount: number): string {
  if (amount >= 10000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toLocaleString();
}
