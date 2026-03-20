import type { Card, Suit } from '@/types';

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_COLORS: Record<Suit, string> = {
  spades: 'text-card-black',
  hearts: 'text-card-red',
  diamonds: 'text-card-red',
  clubs: 'text-card-black',
};

const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const SIZE_CLASSES = {
  sm: 'w-8 h-11 text-xs',
  md: 'w-12 h-16 text-sm',
  lg: 'w-16 h-22 text-base',
};

export function PlayingCard({ card, size = 'md', faceDown = false }: PlayingCardProps) {
  if (faceDown) {
    return (
      <div className={`${SIZE_CLASSES[size]} rounded bg-blue-800 border border-blue-600 shadow flex items-center justify-center`}>
        <div className="w-3/4 h-3/4 rounded border border-blue-500 bg-blue-700" />
      </div>
    );
  }

  return (
    <div className={`${SIZE_CLASSES[size]} rounded bg-white shadow flex flex-col items-center justify-center leading-none ${SUIT_COLORS[card.suit]}`}>
      <span className="font-bold">{RANK_DISPLAY[card.rank]}</span>
      <span>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
