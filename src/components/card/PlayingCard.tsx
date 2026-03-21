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
  spades: '#e5e7eb',
  hearts: '#dc2626',
  diamonds: '#dc2626',
  clubs: '#e5e7eb',
};

const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

// Size map: [svgWidth, svgHeight, tailwindClasses]
const SIZE_MAP = {
  sm: { w: 48, h: 67, cls: 'w-12 h-[67px]' },
  md: { w: 64, h: 90, cls: 'w-16 h-[90px]' },
  lg: { w: 80, h: 112, cls: 'w-20 h-28' },
};

function FaceDownCard({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const { w, h, cls } = SIZE_MAP[size];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`${cls} drop-shadow-md select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Card background */}
      <rect width={w} height={h} rx="4" fill="#1e3a5f" />
      {/* Inner border */}
      <rect
        x="3" y="3"
        width={w - 6} height={h - 6}
        rx="2"
        fill="none"
        stroke="#4a7ab5"
        strokeWidth="1"
      />
      {/* Diamond pattern */}
      {Array.from({ length: Math.ceil(h / 8) }).map((_, row) =>
        Array.from({ length: Math.ceil(w / 8) }).map((_, col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 8 + (row % 2 === 0 ? 0 : 4)}
            y={row * 8}
            width="4"
            height="4"
            transform={`rotate(45 ${col * 8 + (row % 2 === 0 ? 2 : 6)} ${row * 8 + 2})`}
            fill="#2d5a8e"
            opacity="0.6"
          />
        ))
      )}
      {/* Center suit icon */}
      <text
        x={w / 2}
        y={h / 2 + 5}
        textAnchor="middle"
        fill="#4a7ab5"
        fontSize={size === 'lg' ? '18' : size === 'md' ? '14' : '10'}
        fontFamily="system-ui"
      >
        ♠
      </text>
    </svg>
  );
}

function FaceUpCard({
  card,
  size,
}: {
  card: Card;
  size: 'sm' | 'md' | 'lg';
}) {
  const { w, h, cls } = SIZE_MAP[size];
  const rank = RANK_DISPLAY[card.rank];
  const suit = SUIT_SYMBOLS[card.suit];
  const color = SUIT_FILL_COLORS[card.suit];

  const isSmall = size === 'sm';
  const cornerFontSize = isSmall ? 8 : size === 'md' ? 10 : 12;
  const suitCornerFontSize = isSmall ? 7 : size === 'md' ? 9 : 11;
  const centerFontSize = isSmall ? 18 : size === 'md' ? 22 : 28;
  const cornerX = 4;
  const cornerY = 11;
  const isRankTen = rank === '10';

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`${cls} drop-shadow-md select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Card background */}
      <rect width={w} height={h} rx="4" fill="#1e293b" />
      {/* Card border */}
      <rect
        width={w} height={h}
        rx="4"
        fill="none"
        stroke="#334155"
        strokeWidth="0.75"
      />

      {/* Top-left rank */}
      <text
        x={cornerX}
        y={cornerY}
        fill={color}
        fontSize={isRankTen ? cornerFontSize - 1 : cornerFontSize}
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
        dominantBaseline="auto"
      >
        {rank}
      </text>
      {/* Top-left suit */}
      <text
        x={cornerX}
        y={cornerY + suitCornerFontSize + 1}
        fill={color}
        fontSize={suitCornerFontSize}
        fontFamily="system-ui, sans-serif"
        dominantBaseline="auto"
      >
        {suit}
      </text>

      {/* Center suit symbol */}
      <text
        x={w / 2}
        y={h / 2 + centerFontSize * 0.35}
        textAnchor="middle"
        fill={color}
        fontSize={centerFontSize}
        fontFamily="system-ui, sans-serif"
      >
        {suit}
      </text>

      {/* Bottom-right rank + suit (rotated 180deg) */}
      <g transform={`rotate(180 ${w / 2} ${h / 2})`}>
        <text
          x={cornerX}
          y={cornerY}
          fill={color}
          fontSize={isRankTen ? cornerFontSize - 1 : cornerFontSize}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          dominantBaseline="auto"
        >
          {rank}
        </text>
        <text
          x={cornerX}
          y={cornerY + suitCornerFontSize + 1}
          fill={color}
          fontSize={suitCornerFontSize}
          fontFamily="system-ui, sans-serif"
          dominantBaseline="auto"
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
