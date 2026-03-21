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
    <>
      {/* Outer rail (wooden border) */}
      <div
        className="absolute inset-4 rounded-[50%]"
        style={{
          background: 'linear-gradient(145deg, #a0621f 0%, #6b3f10 50%, #7c4a1a 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)',
        }}
      />
      {/* Inner felt surface */}
      <div
        className="absolute flex flex-col items-center justify-center gap-3"
        style={{
          inset: '20px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at 40% 35%, #2d6a3f 0%, #1a5c2a 40%, #0f3d1a 100%)',
          boxShadow: 'inset 0 4px 16px rgba(0,0,0,0.4), inset 0 -2px 8px rgba(0,0,0,0.3)',
          border: '2px solid rgba(0,0,0,0.3)',
        }}
      >
        {/* Subtle felt texture highlight */}
        <div
          className="absolute inset-0 rounded-[50%] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.04) 0%, transparent 60%)',
          }}
        />

        {/* Community Cards */}
        <div className="flex gap-1.5 sm:gap-2 relative z-10">
          {Array.from({ length: 5 }).map((_, i) => {
            const card = communityCards[i];
            return card ? (
              <div key={`${card.encoded}-${i}`} className="transition-opacity duration-300" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }}>
                <PlayingCard card={card} size="md" animate />
              </div>
            ) : (
              <div
                key={i}
                className="w-[72px] h-[100px] rounded"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.2)',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            );
          })}
        </div>

        {/* Pot display */}
        <div
          className={`relative z-10 flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 ${
            potAmount > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.5) 100%)',
            border: '1px solid rgba(234,179,8,0.3)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wide">POT</span>
          <span className="text-white font-bold text-base">
            {formatAmount(potAmount, bb, displayMode)}
          </span>
        </div>
      </div>
    </>
  );
});
