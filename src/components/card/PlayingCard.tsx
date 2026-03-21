import { memo } from 'react';
import type { Card, Suit } from '@/types';

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  animate?: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_FILL_COLORS: Record<Suit, string> = {
  spades: '#e2e8f0',
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#e2e8f0',
};

const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// All cards use a standard 60x84 SVG viewBox for consistent proportions.
// Only the outer container size changes per size variant.
const VB_W = 60;
const VB_H = 84;

const CONTAINER_SIZE = {
  sm: 'w-[58px] h-[81px]',
  md: 'w-[68px] h-[95px]',
  lg: 'w-[88px] h-[123px]',
};

function FaceDownCard({ size }: { size: 'sm' | 'md' | 'lg' }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={`${CONTAINER_SIZE[size]} drop-shadow-md select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={VB_W} height={VB_H} rx="5" fill="#1e3a5f" />
      <rect x="3" y="3" width={VB_W - 6} height={VB_H - 6} rx="3" fill="none" stroke="#4a7ab5" strokeWidth="1" />
      {/* Simple cross-hatch pattern */}
      <defs>
        <pattern id="cardBack" patternUnits="userSpaceOnUse" width="10" height="10">
          <path d="M0 5L5 0M5 10L10 5" stroke="#2d5a8e" strokeWidth="0.8" opacity="0.5" />
        </pattern>
      </defs>
      <rect x="5" y="5" width={VB_W - 10} height={VB_H - 10} rx="2" fill="url(#cardBack)" />
      <text x={VB_W / 2} y={VB_H / 2 + 6} textAnchor="middle" fill="#4a7ab5" fontSize="20" fontFamily="system-ui">♠</text>
    </svg>
  );
}

function FaceUpCard({ card, size }: { card: Card; size: 'sm' | 'md' | 'lg' }) {
  const rank = RANK_DISPLAY[card.rank];
  const suit = SUIT_SYMBOLS[card.suit];
  const color = SUIT_FILL_COLORS[card.suit];

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className={`${CONTAINER_SIZE[size]} drop-shadow-md select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Card background */}
      <rect width={VB_W} height={VB_H} rx="5" fill="#1e293b" />
      <rect width={VB_W} height={VB_H} rx="5" fill="none" stroke="#334155" strokeWidth="0.75" />

      {/* Top-left rank */}
      <text
        x="5" y="17"
        fill={color}
        fontSize={rank === '10' ? '13' : '15'}
        fontWeight="bold"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {rank}
      </text>
      {/* Top-left suit */}
      <text
        x="5" y="29"
        fill={color}
        fontSize="12"
        fontFamily="system-ui, sans-serif"
      >
        {suit}
      </text>

      {/* Center suit symbol — large and prominent */}
      <text
        x={VB_W / 2}
        y={VB_H / 2 + 11}
        textAnchor="middle"
        fill={color}
        fontSize="30"
        fontFamily="system-ui, sans-serif"
      >
        {suit}
      </text>

      {/* Bottom-right rank + suit (rotated 180°) */}
      <g transform={`rotate(180 ${VB_W / 2} ${VB_H / 2})`}>
        <text
          x="5" y="17"
          fill={color}
          fontSize={rank === '10' ? '13' : '15'}
          fontWeight="bold"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {rank}
        </text>
        <text
          x="5" y="29"
          fill={color}
          fontSize="12"
          fontFamily="system-ui, sans-serif"
        >
          {suit}
        </text>
      </g>
    </svg>
  );
}

export const PlayingCard = memo(function PlayingCard({
  card,
  size = 'md',
  faceDown = false,
  animate = false,
}: PlayingCardProps) {
  const animateClass = animate ? 'animate-deal' : '';

  if (faceDown) {
    return (
      <div className={animateClass}>
        <FaceDownCard size={size} />
      </div>
    );
  }

  return (
    <div className={animateClass}>
      <FaceUpCard card={card} size={size} />
    </div>
  );
});
