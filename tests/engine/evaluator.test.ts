import { describe, it, expect } from 'vitest';
import { evaluate7, compareHands, HandCategory, type EvaluatedHand } from '@/engine/evaluator';
import { toEncoded, fromEncoded } from '@/engine/card';
import type { Card, Suit } from '@/types';

/** Helper: create a Card from short notation like "As", "Kh", "2d" */
function card(notation: string): Card {
  const rankMap: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const suitMap: Record<string, Suit> = { 's': 'spades', 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs' };

  const rankChar = notation.slice(0, -1);
  const suitChar = notation.slice(-1);
  const rank = rankMap[rankChar]!;
  const suit = suitMap[suitChar]!;
  return fromEncoded(toEncoded(suit, rank as any));
}

function cards(...notations: string[]): Card[] {
  return notations.map(card);
}

// ========== Category Detection ==========

describe('Hand Category Detection', () => {
  it('should detect Royal Flush', () => {
    const result = evaluate7(cards('As', 'Ks', 'Qs', 'Js', 'Ts'));
    expect(result.category).toBe(HandCategory.ROYAL_FLUSH);
    expect(result.description).toBe('Royal Flush');
  });

  it('should detect Straight Flush', () => {
    const result = evaluate7(cards('9h', '8h', '7h', '6h', '5h'));
    expect(result.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(result.description).toContain('Straight Flush');
  });

  it('should detect Ace-low Straight Flush (wheel flush)', () => {
    const result = evaluate7(cards('Ad', '2d', '3d', '4d', '5d'));
    expect(result.category).toBe(HandCategory.STRAIGHT_FLUSH);
    expect(result.description).toContain('Five high');
  });

  it('should detect Four of a Kind', () => {
    const result = evaluate7(cards('Ks', 'Kh', 'Kd', 'Kc', '7s'));
    expect(result.category).toBe(HandCategory.FOUR_OF_A_KIND);
  });

  it('should detect Full House', () => {
    const result = evaluate7(cards('Jh', 'Jd', 'Jc', '4s', '4h'));
    expect(result.category).toBe(HandCategory.FULL_HOUSE);
  });

  it('should detect Flush', () => {
    const result = evaluate7(cards('Ah', 'Jh', '8h', '4h', '2h'));
    expect(result.category).toBe(HandCategory.FLUSH);
  });

  it('should detect Straight', () => {
    const result = evaluate7(cards('9s', '8h', '7d', '6c', '5s'));
    expect(result.category).toBe(HandCategory.STRAIGHT);
  });

  it('should detect Ace-low Straight (wheel)', () => {
    const result = evaluate7(cards('As', '2h', '3d', '4c', '5s'));
    expect(result.category).toBe(HandCategory.STRAIGHT);
    expect(result.description).toContain('Five high');
  });

  it('should detect Three of a Kind', () => {
    const result = evaluate7(cards('8s', '8h', '8d', 'Kc', '3s'));
    expect(result.category).toBe(HandCategory.THREE_OF_A_KIND);
  });

  it('should detect Two Pair', () => {
    const result = evaluate7(cards('As', 'Ah', 'Kd', 'Kc', '7s'));
    expect(result.category).toBe(HandCategory.TWO_PAIR);
  });

  it('should detect One Pair', () => {
    const result = evaluate7(cards('Qs', 'Qh', 'Ad', '7c', '3s'));
    expect(result.category).toBe(HandCategory.ONE_PAIR);
  });

  it('should detect High Card', () => {
    const result = evaluate7(cards('As', 'Jh', '8d', '5c', '2s'));
    expect(result.category).toBe(HandCategory.HIGH_CARD);
  });
});

// ========== Category Ordering ==========

describe('Category Ordering', () => {
  const hands: [string, string[], number][] = [
    ['Royal Flush', ['As', 'Ks', 'Qs', 'Js', 'Ts'], HandCategory.ROYAL_FLUSH],
    ['Straight Flush', ['9h', '8h', '7h', '6h', '5h'], HandCategory.STRAIGHT_FLUSH],
    ['Four of a Kind', ['Ks', 'Kh', 'Kd', 'Kc', '7s'], HandCategory.FOUR_OF_A_KIND],
    ['Full House', ['Jh', 'Jd', 'Jc', '4s', '4h'], HandCategory.FULL_HOUSE],
    ['Flush', ['Ah', 'Jh', '8h', '4h', '2h'], HandCategory.FLUSH],
    ['Straight', ['9s', '8h', '7d', '6c', '5s'], HandCategory.STRAIGHT],
    ['Three of a Kind', ['8s', '8h', '8d', 'Kc', '3s'], HandCategory.THREE_OF_A_KIND],
    ['Two Pair', ['As', 'Ah', 'Kd', 'Kc', '7s'], HandCategory.TWO_PAIR],
    ['One Pair', ['Qs', 'Qh', 'Ad', '7c', '3s'], HandCategory.ONE_PAIR],
    ['High Card', ['As', 'Jh', '8d', '5c', '2s'], HandCategory.HIGH_CARD],
  ];

  for (let i = 0; i < hands.length - 1; i++) {
    const [nameA, cardsA] = hands[i]!;
    const [nameB, cardsB] = hands[i + 1]!;
    it(`${nameA} beats ${nameB}`, () => {
      const a = evaluate7(cards(...cardsA!));
      const b = evaluate7(cards(...cardsB!));
      expect(compareHands(a, b)).toBe(-1);
    });
  }
});

// ========== Kicker Resolution ==========

describe('Kicker Resolution', () => {
  it('higher pair beats lower pair', () => {
    const aces = evaluate7(cards('As', 'Ah', 'Kd', '7c', '3s'));
    const kings = evaluate7(cards('Ks', 'Kh', 'Qd', '7c', '3s'));
    expect(compareHands(aces, kings)).toBe(-1);
  });

  it('same pair, higher kicker wins', () => {
    const aceKicker = evaluate7(cards('Qs', 'Qh', 'Ad', '7c', '3s'));
    const kingKicker = evaluate7(cards('Qs', 'Qd', 'Kh', '7c', '3s'));
    expect(compareHands(aceKicker, kingKicker)).toBe(-1);
  });

  it('same pair, same first kicker, second kicker decides', () => {
    const a = evaluate7(cards('Qs', 'Qh', 'Ad', '8c', '3s'));
    const b = evaluate7(cards('Qs', 'Qd', 'Ah', '7c', '3s'));
    expect(compareHands(a, b)).toBe(-1);
  });

  it('two pair: higher top pair wins', () => {
    const akPair = evaluate7(cards('As', 'Ah', 'Kd', 'Kc', '7s'));
    const aqPair = evaluate7(cards('As', 'Ad', 'Qh', 'Qc', '7s'));
    expect(compareHands(akPair, aqPair)).toBe(-1);
  });

  it('two pair: same pairs, kicker decides', () => {
    const a = evaluate7(cards('As', 'Ah', 'Kd', 'Kc', 'Qs'));
    const b = evaluate7(cards('As', 'Ad', 'Kh', 'Ks', 'Js'));
    expect(compareHands(a, b)).toBe(-1);
  });

  it('flush: higher cards win', () => {
    const a = evaluate7(cards('Ah', 'Kh', '8h', '4h', '2h'));
    const b = evaluate7(cards('Ah', 'Qh', '8h', '4h', '2h'));
    expect(compareHands(a, b)).toBe(-1);
  });

  it('high card: compare top down', () => {
    const a = evaluate7(cards('As', 'Kh', '8d', '5c', '2s'));
    const b = evaluate7(cards('As', 'Qh', '8d', '5c', '2s'));
    expect(compareHands(a, b)).toBe(-1);
  });

  it('four of a kind: kicker decides when quads match', () => {
    const a = evaluate7(cards('Ks', 'Kh', 'Kd', 'Kc', 'As'));
    const b = evaluate7(cards('Ks', 'Kh', 'Kd', 'Kc', 'Qs'));
    expect(compareHands(a, b)).toBe(-1);
  });
});

// ========== Tie Detection ==========

describe('Tie Detection', () => {
  it('identical hands should tie', () => {
    const a = evaluate7(cards('As', 'Kh', 'Qd', 'Jc', '9s'));
    const b = evaluate7(cards('Ah', 'Kd', 'Qc', 'Js', '9h'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('same straight should tie regardless of suit', () => {
    const a = evaluate7(cards('9s', '8h', '7d', '6c', '5s'));
    const b = evaluate7(cards('9h', '8d', '7c', '6s', '5h'));
    expect(compareHands(a, b)).toBe(0);
  });

  it('same two pair with same kicker should tie', () => {
    const a = evaluate7(cards('As', 'Ah', 'Kd', 'Kc', 'Qs'));
    const b = evaluate7(cards('Ad', 'Ac', 'Kh', 'Ks', 'Qh'));
    expect(compareHands(a, b)).toBe(0);
  });
});

// ========== 7-Card Evaluation ==========

describe('7-Card Evaluation', () => {
  it('should find the best 5 from 7 cards', () => {
    // Hole: As, Ks. Board: Qs, Js, Ts, 3h, 2d
    // Best hand: Royal Flush (As Ks Qs Js Ts)
    const result = evaluate7(cards('As', 'Ks', 'Qs', 'Js', 'Ts', '3h', '2d'));
    expect(result.category).toBe(HandCategory.ROYAL_FLUSH);
  });

  it('should find flush from 7 cards with mixed suits', () => {
    // 5 hearts + 2 non-hearts
    const result = evaluate7(cards('Ah', 'Kh', '8h', '4h', '2h', 'Ks', 'Qd'));
    expect(result.category).toBe(HandCategory.FLUSH);
  });

  it('should prefer higher category over lower', () => {
    // Has both a pair and a straight — straight should win
    const result = evaluate7(cards('9s', '8h', '7d', '6c', '5s', '5h', '2d'));
    expect(result.category).toBe(HandCategory.STRAIGHT);
  });

  it('should pick full house over two pair from 7 cards', () => {
    // Js Jh Jd 4s 4h Kc 2d → Full House (Js over 4s)
    const result = evaluate7(cards('Js', 'Jh', 'Jd', '4s', '4h', 'Kc', '2d'));
    expect(result.category).toBe(HandCategory.FULL_HOUSE);
  });

  it('should pick the best full house from two possible', () => {
    // Js Jh Jd 4s 4h 4d 2c → FH Jacks full of 4s vs FH 4s full of Jacks → Jacks wins
    const result = evaluate7(cards('Js', 'Jh', 'Jd', '4s', '4h', '4d', '2c'));
    expect(result.category).not.toBe(HandCategory.FOUR_OF_A_KIND);
    expect(result.category).toBe(HandCategory.FULL_HOUSE);
    expect(result.description).toContain('Jack');
  });
});

// ========== Edge Cases ==========

describe('Edge Cases', () => {
  it('should handle 5-card input directly', () => {
    const result = evaluate7(cards('As', 'Kh', 'Qd', 'Jc', 'Ts'));
    expect(result.category).toBe(HandCategory.STRAIGHT);
  });

  it('should handle 6-card input', () => {
    const result = evaluate7(cards('As', 'Kh', 'Qd', 'Jc', 'Ts', '2s'));
    expect(result.category).toBe(HandCategory.STRAIGHT);
  });

  it('should throw on fewer than 5 cards', () => {
    expect(() => evaluate7(cards('As', 'Kh', 'Qd', 'Jc'))).toThrow();
  });

  it('should throw on more than 7 cards', () => {
    expect(() => evaluate7(cards('As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '8s', '7s'))).toThrow();
  });

  it('Ace-high straight beats King-high straight', () => {
    const aceHigh = evaluate7(cards('As', 'Kh', 'Qd', 'Jc', 'Ts'));
    const kingHigh = evaluate7(cards('Ks', 'Qh', 'Jd', 'Tc', '9s'));
    expect(compareHands(aceHigh, kingHigh)).toBe(-1);
  });

  it('King-high straight beats Ace-low straight (wheel)', () => {
    const kingHigh = evaluate7(cards('Ks', 'Qh', 'Jd', 'Tc', '9s'));
    const wheel = evaluate7(cards('As', '2h', '3d', '4c', '5s'));
    expect(compareHands(kingHigh, wheel)).toBe(-1);
  });
});

// ========== Performance ==========

describe('Performance', () => {
  it('should evaluate 7-card hand in < 0.1ms (average over 10K evaluations)', () => {
    // Build 10K random 7-card hands
    const allCards: Card[] = [];
    for (let i = 0; i < 52; i++) {
      allCards.push(fromEncoded(i));
    }

    const start = performance.now();
    const iterations = 10_000;

    for (let n = 0; n < iterations; n++) {
      // Simple deterministic "shuffle" for test — just rotate
      const offset = (n * 7) % 45;
      const hand = allCards.slice(offset, offset + 7);
      evaluate7(hand);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;

    // Should be well under 0.1ms per evaluation
    expect(avgMs).toBeLessThan(0.1);
  });
});
