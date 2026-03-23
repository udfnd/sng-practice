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

describe('classifyHand — Draw Tiers (higher = stronger)', () => {
  it('Tier 4: nut flush draw (Ah with 4 hearts)', () => {
    const result = classifyHand(
      [card('Ah'), card('9h')],
      [card('Kh'), card('7h'), card('2d')],
    );
    expect(result.drawTier).toBe(4);
    expect(result.isNutDraw).toBe(true);
    expect(result.drawDescription).toContain('flush');
  });

  it('Tier 3: non-nut flush draw', () => {
    const result = classifyHand(
      [card('9h'), card('6h')],
      [card('Kh'), card('7h'), card('2d')],
    );
    expect(result.drawTier).toBe(3);
    expect(result.isNutDraw).toBe(false);
    expect(result.drawDescription).toContain('Flush');
  });

  it('Tier 2: open-ended straight draw', () => {
    const result = classifyHand(
      [card('8h'), card('7d')],
      [card('6s'), card('5c'), card('Kd')],
    );
    expect(result.drawTier).toBe(2);
    expect(result.drawDescription).toContain('straight');
  });

  it('Tier 1: gutshot', () => {
    // Jh-Th on 8s-7c-2d: window 7-11 has 7,8,T(10),J(11) = 4 of 5, missing 9 (interior) = gutshot
    const result = classifyHand(
      [card('Jh'), card('Th')],
      [card('8s'), card('7c'), card('2d')],
    );
    expect(result.drawTier).toBe(1);
    expect(result.drawDescription).toContain('Gutshot');
  });

  it('Tier 0: no draw', () => {
    const result = classifyHand(
      [card('Ah'), card('2d')],
      [card('Ks'), card('9c'), card('6h')],
    );
    expect(result.drawTier).toBe(0);
  });
});

describe('classifyHand — Made Hands (evaluator integration)', () => {
  it('detects set correctly (tier 1)', () => {
    const result = classifyHand(
      [card('7h'), card('7d')],
      [card('7s'), card('Kc'), card('2d')],
    );
    expect(result.madeTier).toBe(1);
    expect(result.madeDescription).toBe('Set');
    expect(result.handCategory).toBe(3); // THREE_OF_A_KIND
  });

  it('detects two pair correctly (tier 1 for top two pair)', () => {
    const result = classifyHand(
      [card('Ah'), card('Kd')],
      [card('As'), card('Kc'), card('2d')],
    );
    expect(result.madeTier).toBe(1);
    expect(result.madeDescription).toBe('Top two pair');
    expect(result.handCategory).toBe(2); // TWO_PAIR
  });

  it('detects flush correctly (tier 1)', () => {
    const result = classifyHand(
      [card('Ah'), card('9h')],
      [card('Kh'), card('7h'), card('2h')],
    );
    expect(result.madeTier).toBe(1);
    expect(result.madeDescription).toContain('Flush');
    expect(result.handCategory).toBe(5); // FLUSH
  });

  it('detects straight correctly (tier 1)', () => {
    const result = classifyHand(
      [card('9h'), card('8d')],
      [card('7s'), card('6c'), card('5d')],
    );
    expect(result.madeTier).toBe(1);
    expect(result.madeDescription).toBe('Straight');
    expect(result.handCategory).toBe(4); // STRAIGHT
  });

  it('detects full house correctly (tier 1)', () => {
    const result = classifyHand(
      [card('Ah'), card('Ad')],
      [card('As'), card('Kc'), card('Kd')],
    );
    expect(result.madeTier).toBe(1);
    expect(result.madeDescription).toBe('Full house');
    expect(result.handCategory).toBe(6); // FULL_HOUSE
  });

  it('nutStrength is high for strong hands', () => {
    const result = classifyHand(
      [card('Ah'), card('Ad')],
      [card('As'), card('Kc'), card('2d')],
    );
    expect(result.nutStrength).toBeGreaterThan(0.6);
  });

  it('nutStrength is low for air', () => {
    const result = classifyHand(
      [card('4h'), card('3d')],
      [card('As'), card('Kc'), card('Qd')],
    );
    expect(result.nutStrength).toBeLessThan(0.15);
  });
});

describe('classifyHand — Backdoor Draws', () => {
  it('detects backdoor flush draw on flop', () => {
    const result = classifyHand(
      [card('Ah'), card('9d')],
      [card('Kh'), card('7c'), card('2h')],
    );
    expect(result.backdoorFlush).toBe(true);
  });

  it('no backdoor flush on turn', () => {
    const result = classifyHand(
      [card('Ah'), card('9d')],
      [card('Kh'), card('7c'), card('2h'), card('5d')],
    );
    expect(result.backdoorFlush).toBe(false);
  });

  it('detects backdoor straight draw on flop', () => {
    const result = classifyHand(
      [card('Th'), card('9d')],
      [card('7s'), card('3c'), card('2d')],
    );
    expect(result.backdoorStraight).toBe(true);
  });
});
