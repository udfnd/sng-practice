import { describe, it, expect } from 'vitest';
import { classifyHand } from '@/ai/hand-classifier';
import { toEncoded, fromEncoded } from '@/engine/card';
import type { Card, Suit } from '@/types';

function card(notation: string): Card {
  const rankMap: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const suitMap: Record<string, Suit> = { 's': 'spades', 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs' };
  return fromEncoded(toEncoded(suitMap[notation.slice(-1)]!, rankMap[notation.slice(0, -1)]! as any));
}

describe('classifyHand — Made Tiers', () => {
  it('Tier 1: top pair strong kicker', () => {
    const result = classifyHand(
      [card('Ah'), card('Kd')],
      [card('As'), card('7c'), card('2d')],
    );
    expect(result.madeTier).toBe(1);
  });

  it('Tier 1: overpair', () => {
    const result = classifyHand(
      [card('Kh'), card('Kd')],
      [card('Qs'), card('7c'), card('2d')],
    );
    expect(result.madeTier).toBe(1);
  });

  it('Tier 2: top pair weak kicker', () => {
    const result = classifyHand(
      [card('Ah'), card('3d')],
      [card('As'), card('Kc'), card('7d')],
    );
    expect(result.madeTier).toBe(2);
  });

  it('Tier 2: second pair', () => {
    const result = classifyHand(
      [card('Kh'), card('2d')],
      [card('As'), card('Kc'), card('7d')],
    );
    expect(result.madeTier).toBe(2);
  });

  it('Tier 3: bottom pair', () => {
    const result = classifyHand(
      [card('7h'), card('3d')],
      [card('As'), card('Kc'), card('7d')],
    );
    // Board: As(14), Kc(13), 7d(7). 7h matches 7d (third board card) → bottom pair
    expect(result.madeTier).toBe(3);
  });

  it('Tier 3: Ace high', () => {
    const result = classifyHand(
      [card('Ah'), card('Jd')],
      [card('Ks'), card('9c'), card('2d')],
    );
    expect(result.madeTier).toBe(3);
  });

  it('Tier 4: nothing', () => {
    const result = classifyHand(
      [card('8h'), card('7d')],
      [card('As'), card('Kc'), card('2d')],
    );
    expect(result.madeTier).toBe(4);
  });
});

describe('classifyHand — Draw Tiers', () => {
  it('Tier 2: flush draw', () => {
    const result = classifyHand(
      [card('Ah'), card('9h')],
      [card('Kh'), card('7h'), card('2d')],
    );
    expect(result.drawTier).toBe(2);
    expect(result.drawDescription).toContain('Flush');
  });

  it('Tier 3: open-ended straight draw', () => {
    const result = classifyHand(
      [card('8h'), card('7d')],
      [card('6s'), card('5c'), card('Kd')],
    );
    expect(result.drawTier).toBe(3);
    expect(result.drawDescription).toContain('straight');
  });

  it('Tier 0: no draw', () => {
    const result = classifyHand(
      [card('Ah'), card('2d')],
      [card('Ks'), card('9c'), card('6h')],
    );
    expect(result.drawTier).toBe(0);
  });
});
