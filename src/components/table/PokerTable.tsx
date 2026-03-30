import { memo } from 'react';
import type { Card, Suit } from '@/types';
import { PlayingCard } from '@/components/card/PlayingCard';
import { useGameStore } from '@/store/game-store';
import { formatAmount } from '@/utils/format-chips';

const SUIT_NAMES: Record<Suit, string> = {
  spades: 'spades',
  hearts: 'hearts',
  diamonds: 'diamonds',
  clubs: 'clubs',
};

const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

function describeCard(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

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
  const blindLevel = useGameStore((s) => s.gameState?.blindLevel);

  const communityCardDescriptions = communityCards.length > 0
    ? communityCards.map(describeCard).join(', ')
    : 'none';

  const level = blindLevel?.level ?? 1;
  const sb = blindLevel?.sb ?? 10;
  const bbVal = blindLevel?.bb ?? 20;
  const ante = blindLevel?.ante ?? 0;

  return (
    <div className="w-full h-full relative">
      {/* Outer rail (wooden border) */}
      <div
        className="absolute inset-0 rounded-[9999px]"
        style={{
          background: 'linear-gradient(145deg, #8b5520 0%, #6b3f10 50%, #4a2c0a 100%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6)',
        }}
      />
      {/* Inner felt surface */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: '7px', bottom: '7px', left: '7px', right: '7px',
          borderRadius: '9999px',
          background: 'radial-gradient(ellipse at 40% 35%, #2d6a3f 0%, #1a5c2a 45%, #0f3d1a 100%)',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5), inset 0 -2px 10px rgba(0,0,0,0.4)',
          border: '2px solid rgba(0,0,0,0.4)',
          gap: '8px',
        }}
      >
        {/* Felt texture highlight */}
        <div
          className="absolute inset-0 rounded-[9999px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 25%, rgba(255,255,255,0.05) 0%, transparent 55%)',
          }}
        />

        {/* Blind level info — displayed on the felt */}
        <div
          className="relative z-10"
          aria-label={`Blind level ${level}: ${sb}/${bbVal}${ante ? ` ante ${ante}` : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ color: 'rgba(251,191,36,0.8)', fontWeight: 700, fontSize: '11px' }}>
            Lv.{level}
          </span>
          <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {sb}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>/</span>
          <span style={{ color: '#60a5fa', fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {bbVal}
          </span>
          {ante > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>|</span>
              <span style={{ color: '#fb923c', fontSize: '11px', fontWeight: 600 }}>
                A {ante}
              </span>
            </>
          )}
        </div>

        {/* Community Cards */}
        <div
          className="flex gap-1 sm:gap-2 relative z-10"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.6))' }}
          aria-label={`Community cards: ${communityCardDescriptions}`}
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const card = communityCards[i];
            return card ? (
              <div key={`${card.encoded}-${i}`} className="community-card transition-opacity duration-300">
                <PlayingCard card={card} size="xs" animate animationDelay={i * 100} />
              </div>
            ) : (
              <div
                key={i}
                className="community-card-placeholder rounded"
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(0,0,0,0.18)',
                  boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)',
                  borderRadius: 'var(--radius-sm)',
                }}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {/* Pot display */}
        <div
          role="status"
          aria-label={`Pot: ${formatAmount(potAmount, bb, displayMode)}`}
          aria-live="polite"
          className="relative z-10 flex items-center gap-2 px-4 py-1.5 transition-all duration-300"
          style={{
            opacity: potAmount > 0 ? 1 : 0,
            transform: potAmount > 0 ? 'scale(1)' : 'scale(0.92)',
            pointerEvents: potAmount > 0 ? 'auto' : 'none',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(251,191,36,0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>POT</span>
          <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: '16px', fontVariantNumeric: 'tabular-nums' }}>
            {formatAmount(potAmount, bb, displayMode)}
          </span>
        </div>
      </div>
    </div>
  );
});
