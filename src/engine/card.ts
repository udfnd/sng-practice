import type { Card, DisplayRank, Suit } from '@/types';

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const SUIT_INDEX: Record<Suit, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

/**
 * Encode a card as a single integer: suit_index * 13 + rank_index.
 * rank_index is 0-based: 0 = 2, 1 = 3, ..., 12 = Ace.
 */
export function toEncoded(suit: Suit, rank: DisplayRank): number {
  const suitIdx = SUIT_INDEX[suit];
  const rankIdx = rank - 2; // DisplayRank 2–14 → index 0–12
  return suitIdx * 13 + rankIdx;
}

/**
 * Decode an encoded card integer back to a Card object.
 */
export function fromEncoded(encoded: number): Card {
  if (encoded < 0 || encoded > 51 || !Number.isInteger(encoded)) {
    throw new RangeError(`Invalid encoded card: ${encoded}. Must be integer 0–51.`);
  }
  const suitIdx = Math.floor(encoded / 13);
  const rankIdx = encoded % 13;
  const suit = SUITS[suitIdx]!;
  const rank = (rankIdx + 2) as DisplayRank;
  return { encoded, suit, rank };
}

/**
 * Get a short string representation of a card (e.g., "As", "Kh", "2d").
 */
export function cardToString(card: Card): string {
  const rankChars = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suitChars: Record<Suit, string> = { spades: 's', hearts: 'h', diamonds: 'd', clubs: 'c' };
  return rankChars[card.rank - 2]! + suitChars[card.suit];
}

/**
 * Create all 52 cards as encoded integers (0–51).
 */
export function createFullDeckEncoded(): number[] {
  return Array.from({ length: 52 }, (_, i) => i);
}
