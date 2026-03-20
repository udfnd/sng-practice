import { describe, it, expect } from 'vitest';
import { toEncoded, fromEncoded, cardToString, createFullDeckEncoded } from '@/engine/card';
import type { Suit, DisplayRank } from '@/types';

describe('Card Encoding', () => {
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const ranks: DisplayRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  it('should encode all 52 cards to unique values 0–51', () => {
    const encoded = new Set<number>();
    for (const suit of suits) {
      for (const rank of ranks) {
        const val = toEncoded(suit, rank);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(51);
        encoded.add(val);
      }
    }
    expect(encoded.size).toBe(52);
  });

  it('should encode spades-2 as 0', () => {
    expect(toEncoded('spades', 2)).toBe(0);
  });

  it('should encode clubs-Ace as 51', () => {
    expect(toEncoded('clubs', 14)).toBe(51);
  });

  it('should encode hearts-King as 24', () => {
    // hearts = suit_index 1, King = rank_index 11 → 1*13 + 11 = 24
    expect(toEncoded('hearts', 13)).toBe(24);
  });

  describe('toEncoded and fromEncoded are inverse functions', () => {
    for (const suit of suits) {
      for (const rank of ranks) {
        it(`roundtrips ${rank} of ${suit}`, () => {
          const encoded = toEncoded(suit, rank);
          const card = fromEncoded(encoded);
          expect(card.suit).toBe(suit);
          expect(card.rank).toBe(rank);
          expect(card.encoded).toBe(encoded);
        });
      }
    }
  });

  it('should throw on invalid encoded values', () => {
    expect(() => fromEncoded(-1)).toThrow(RangeError);
    expect(() => fromEncoded(52)).toThrow(RangeError);
    expect(() => fromEncoded(1.5)).toThrow(RangeError);
  });
});

describe('cardToString', () => {
  it('should format Ace of spades as "As"', () => {
    expect(cardToString(fromEncoded(toEncoded('spades', 14)))).toBe('As');
  });

  it('should format 10 of hearts as "Th"', () => {
    expect(cardToString(fromEncoded(toEncoded('hearts', 10)))).toBe('Th');
  });

  it('should format 2 of clubs as "2c"', () => {
    expect(cardToString(fromEncoded(toEncoded('clubs', 2)))).toBe('2c');
  });
});

describe('createFullDeckEncoded', () => {
  it('should create 52 unique encoded values', () => {
    const deck = createFullDeckEncoded();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('should contain values 0–51', () => {
    const deck = createFullDeckEncoded();
    for (let i = 0; i < 52; i++) {
      expect(deck).toContain(i);
    }
  });
});
