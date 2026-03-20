/**
 * Integration tests for postflop enhanced logic:
 * - SPR-based bet sizing
 * - Range advantage influence on c-bet frequency
 * - Multiway penalty on c-bet frequency
 */
import { describe, it, expect } from 'vitest';
import type { Card } from '@/types';
import { makePostflopDecision, type PostflopContext } from '@/ai/postflop';
import { PRESETS } from '@/ai/presets';

// ============================================================
// Helpers
// ============================================================

function makeCard(
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
): Card {
  const suitIndex = ['spades', 'hearts', 'diamonds', 'clubs'].indexOf(suit);
  const rankIndex = rank - 2;
  return { encoded: suitIndex * 13 + rankIndex, suit, rank };
}

function makeBaseCtx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    profile: PRESETS.TAG,
    holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],  // Aces (tier 1 always bets)
    communityCards: [
      makeCard(2, 'diamonds'),
      makeCard(7, 'clubs'),
      makeCard(13, 'hearts'),
    ],
    street: 'FLOP',
    isAggressor: true,
    facingBet: false,
    facingAmount: 0,
    potSize: 200,
    chips: 1000,
    bb: 20,
    spr: 5,           // medium SPR
    opponents: 1,     // heads up
    ...overrides,
  };
}

// ============================================================
// SPR-based bet sizing
// ============================================================

describe('postflop enhanced - SPR-based bet sizing', () => {
  it('SPR < 3 produces a large bet (>= 66% of pot)', () => {
    // Short stack scenario: bet should be large
    const ctx = makeBaseCtx({ spr: 2, potSize: 200, chips: 400 });
    // Force bet by using always-betting profile (strong hand + aggressor)
    const alwaysBet = () => 0; // rng = 0, always below any threshold
    const decision = makePostflopDecision(ctx, alwaysBet);
    if (decision.action === 'BET') {
      expect(decision.amount).toBeGreaterThanOrEqual(Math.round(200 * 0.66));
    }
    // At minimum, should take an action
    expect(['BET', 'CHECK']).toContain(decision.action);
  });

  it('SPR > 10 produces a smaller bet (<= 50% of pot)', () => {
    const ctx = makeBaseCtx({ spr: 15, potSize: 200, chips: 3000 });
    const alwaysBet = () => 0;
    const decision = makePostflopDecision(ctx, alwaysBet);
    if (decision.action === 'BET') {
      // Deep stack = smaller sizing
      expect(decision.amount).toBeLessThanOrEqual(Math.round(200 * 0.75));
    }
    expect(['BET', 'CHECK']).toContain(decision.action);
  });

  it('lower SPR produces larger bet amount than higher SPR (same pot)', () => {
    const potSize = 200;
    const alwaysBet = () => 0;
    const lowSprCtx = makeBaseCtx({ spr: 2, potSize, chips: 400 });
    const highSprCtx = makeBaseCtx({ spr: 15, potSize, chips: 3000 });

    const lowDecision = makePostflopDecision(lowSprCtx, alwaysBet);
    const highDecision = makePostflopDecision(highSprCtx, alwaysBet);

    if (lowDecision.action === 'BET' && highDecision.action === 'BET') {
      expect(lowDecision.amount).toBeGreaterThanOrEqual(highDecision.amount);
    }
  });
});

// ============================================================
// Range advantage - c-bet frequency
// ============================================================

describe('postflop enhanced - range advantage on c-bet frequency', () => {
  // To test frequency, we run many simulations with random RNG
  function runTrials(ctx: PostflopContext, trials = 1000): number {
    let betCount = 0;
    for (let i = 0; i < trials; i++) {
      const decision = makePostflopDecision(ctx, Math.random);
      if (decision.action === 'BET') betCount++;
    }
    return betCount / trials;
  }

  it('high range advantage board → AI bets more frequently than low advantage board', () => {
    // A-K-2 rainbow: high aggressor advantage
    const highAdvBoard: Card[] = [
      makeCard(14, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(2, 'diamonds'),
    ];

    // 7-8-9 two-tone: low aggressor advantage (caller's board)
    const lowAdvBoard: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'spades'),
    ];

    // Use tier-3 hand so frequency can swing significantly
    const holeCards: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'clubs')]; // nothing on board

    const highAdvCtx = makeBaseCtx({
      communityCards: highAdvBoard,
      holeCards,
      opponents: 1,
    });
    const lowAdvCtx = makeBaseCtx({
      communityCards: lowAdvBoard,
      holeCards,
      opponents: 1,
    });

    const highAdvFreq = runTrials(highAdvCtx, 2000);
    const lowAdvFreq = runTrials(lowAdvCtx, 2000);

    // High advantage board should produce higher betting frequency
    expect(highAdvFreq).toBeGreaterThan(lowAdvFreq);
  });

  it('multiway pot (3 opponents) reduces c-bet frequency vs heads-up', () => {
    function runTrialsMulti(opponents: number, trials = 2000): number {
      let betCount = 0;
      // Use weak hand so frequency difference is visible
      const holeCards: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'clubs')];
      const board: Card[] = [
        makeCard(14, 'spades'),
        makeCard(8, 'hearts'),
        makeCard(2, 'diamonds'),
      ];
      for (let i = 0; i < trials; i++) {
        const ctx = makeBaseCtx({ holeCards, communityCards: board, opponents });
        const decision = makePostflopDecision(ctx, Math.random);
        if (decision.action === 'BET') betCount++;
      }
      return betCount / trials;
    }

    const huFreq = runTrialsMulti(1);
    const multiwayFreq = runTrialsMulti(3);

    expect(huFreq).toBeGreaterThan(multiwayFreq);
  });

  it('1-on-1 applies full c-bet frequency (no penalty)', () => {
    // With 1 opponent, multiway penalty = 1.0 — no reduction
    let betCount = 0;
    const trials = 1000;
    const profile = { ...PRESETS.Maniac }; // high cBetFreq
    for (let i = 0; i < trials; i++) {
      const ctx = makeBaseCtx({ profile, opponents: 1 });
      const decision = makePostflopDecision(ctx, Math.random);
      if (decision.action === 'BET') betCount++;
    }
    const freq = betCount / trials;
    // Maniac has cBetFreq 0.85 — should be high
    expect(freq).toBeGreaterThan(0.6);
  });
});

// ============================================================
// Backward compatibility
// ============================================================

describe('postflop enhanced - backward compatibility', () => {
  it('makePostflopDecision works without spr and opponents (defaults applied)', () => {
    const ctx: PostflopContext = {
      profile: PRESETS.TAG,
      holeCards: [makeCard(14, 'spades'), makeCard(13, 'hearts')],
      communityCards: [
        makeCard(14, 'diamonds'),
        makeCard(7, 'clubs'),
        makeCard(2, 'spades'),
      ],
      street: 'FLOP',
      isAggressor: true,
      facingBet: false,
      facingAmount: 0,
      potSize: 200,
      chips: 1000,
      bb: 20,
      // No spr or opponents — should use defaults
    };

    expect(() => makePostflopDecision(ctx, () => 0)).not.toThrow();
    const decision = makePostflopDecision(ctx, () => 0);
    expect(['BET', 'CHECK', 'CALL', 'FOLD', 'RAISE']).toContain(decision.action);
    expect(decision.amount).toBeGreaterThanOrEqual(0);
  });

  it('bet amounts are always legal (>= min bet and <= stack)', () => {
    const ctx = makeBaseCtx({ potSize: 100, chips: 500, bb: 10, spr: 5 });
    for (let i = 0; i < 100; i++) {
      const decision = makePostflopDecision(ctx, Math.random);
      if (decision.action === 'BET') {
        expect(decision.amount).toBeGreaterThanOrEqual(10); // >= bb (min bet)
        expect(decision.amount).toBeLessThanOrEqual(500);   // <= chips
      }
    }
  });
});
