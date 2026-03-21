import { memo } from 'react';
import type { Card } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { useGameStore } from '@/store/game-store';
import { formatAmount } from '@/utils/format-chips';

interface PokerTableProps {
  communityCards: Card[];
  potAmount: number;
}

export const PokerTable = memo(function PokerTable({
  communityCards,
  potAmount,
}: PokerTableProps) {
  const displayMode = useGameStore((s) => s.displayMode);
  const bb = useGameStore((s) => s.gameState?.blindLevel.bb ?? 1);

  return (
    <div
      className="absolute inset-8 rounded-[50%] flex flex-col items-center justify-center gap-2"
      style={{
        background: 'radial-gradient(ellipse at center, #1a5c2a 0%, #0f3d1a 100%)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)',
        border: '4px solid #0f3d1a',
      }}
    >
      {/* Community Cards */}
      <div className="flex gap-1.5 sm:gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const card = communityCards[i];
          return card ? (
            <div key={`${card.encoded}-${i}`} className="transition-opacity duration-300">
              <PlayingCard card={card} size="md" animate />
            </div>
          ) : (
            <div
              key={i}
              className="w-16 h-[90px] rounded"
              style={{
                border: '1px solid rgba(148,163,184,0.2)',
                background: 'rgba(100,116,139,0.1)',
              }}
            />
          );
        })}
      </div>

      {/* Pot */}
      <div
        className={`font-bold text-sm px-3 py-1 rounded-full transition-all duration-300 ${
          potAmount > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{
          background: 'rgba(0,0,0,0.5)',
          color: '#f1f5f9',
        }}
      >
        Pot: {formatAmount(potAmount, bb, displayMode)}
      </div>
    </div>
  );
});
