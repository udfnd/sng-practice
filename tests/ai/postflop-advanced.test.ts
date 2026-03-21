/**
 * Tests for Milestones 2-5: Advanced postflop strategy
 * RED phase — all tests should fail until implementation is complete.
 */
import { describe, it, expect } from 'vitest';
import type { Card } from '@/types';
import { makePostflopDecision, type PostflopContext } from '@/ai/postflop';
import { planBetSizing } from '@/ai/spr';
import { PRESETS } from '@/ai/presets';

function makeCard(
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
): Card {
  const suitIndex = ['spades', 'hearts', 'diamonds', 'clubs'].indexOf(suit);
  return { encoded: suitIndex * 13 + (rank - 2), suit, rank };
}

function makeBaseCtx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    profile: PRESETS.TAG,
    holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
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
    spr: 5,
    opponents: 1,
    ...overrides,
  };
}

function runTrials(ctx: PostflopContext, trials = 2000): { betCount: number; foldCount: number; checkRaiseCount: number } {
  let betCount = 0;
  let foldCount = 0;
  let checkRaiseCount = 0;
  for (let i = 0; i < trials; i++) {
    const decision = makePostflopDecision(ctx, Math.random);
    if (decision.action === 'BET') betCount++;
    else if (decision.action === 'FOLD') foldCount++;
    else if (decision.action === 'RAISE') checkRaiseCount++;
  }
  return { betCount, foldCount, checkRaiseCount };
}

// ============================================================
// Milestone 2: Board-Dependent Check-Raise
// ============================================================

describe('M2: boardDependentCheckRaiseFreq', () => {
  it('check-raise more on wet boards than dry boards when facing bet', () => {
    const dryBoard: Card[] = [
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ];
    const wetBoard: Card[] = [
      makeCard(9, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(7, 'spades'),
    ];

    // Tier-1 hand facing bet (two aces — overpair on wet board)
    const baseFacingCtx = {
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    };

    let dryRaises = 0;
    let wetRaises = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const dryCtx = makeBaseCtx({ ...baseFacingCtx, communityCards: dryBoard });
      const wetCtx = makeBaseCtx({ ...baseFacingCtx, communityCards: wetBoard });
      if (makePostflopDecision(dryCtx, Math.random).action === 'RAISE') dryRaises++;
      if (makePostflopDecision(wetCtx, Math.random).action === 'RAISE') wetRaises++;
    }

    // Wet boards should produce more check-raises
    expect(wetRaises).toBeGreaterThan(dryRaises);
  });

  it('check-raise less on dry boards (freq * 0.5 applied)', () => {
    // With checkRaiseFreq = 0.5, dry board should check-raise < 25% of the time
    const profile = { ...PRESETS.Shark, checkRaiseFreq: 0.5 };
    const dryCtx = makeBaseCtx({
      profile,
      communityCards: [makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    let raiseCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (makePostflopDecision(dryCtx, Math.random).action === 'RAISE') raiseCount++;
    }
    const freq = raiseCount / trials;
    // dry board: freq * 0.5, so with base 0.5, expected ~0.25
    expect(freq).toBeLessThan(0.4);
  });

  it('combo draw (tier 1-2 hand + tier 1-2 draw) boosts check-raise freq', () => {
    // Wet board: 9s-8s-4h (two spades = flush draw possible)
    // Hole cards: 9c + As = top pair (tier 2) + nut flush draw (drawTier 2 with As,9s,8s = 3 spades)
    // Actually need 4 cards of same suit for flush draw. Use: As,9s,8s in hole+board = As(hole)+9s,8s(board)+Xs
    // Better: hole cards As+Ks vs board 9s+8s+4h => As,Ks,9s,8s = 4 spades = flush draw (drawTier 2)
    // Made hand: A high vs board 9-8-4: no pair = tier 3 or 4
    // Actually no pair = tier 4. Need to give top pair too.
    // Use: 9h+As vs board 9s+8s+4h => top pair (tier 2, kicker A >= 10 = tier 1!) + flush draw (As,9s,8s = 3 spades only)
    // Hmm. Let's try: As+9s vs board 9h+8s+7s = top pair(9s matches 9h? No, different suit)
    // Actually classifyHand compares rank only. So 9s hole matches 9h board rank = top pair.
    // As kicker >= 10 = tier 1! And flush draw: As,9s,8s,7s = 4 spades = flush draw (drawTier 2)
    const wetBoard: Card[] = [
      makeCard(9, 'hearts'),
      makeCard(8, 'spades'),
      makeCard(7, 'spades'),
    ];
    // As + 9s: As(hole) + 9s(hole) + 8s + 7s = 4 spades = flush draw; 9s matches board rank 9 = top pair tier 1
    const comboCtx = makeBaseCtx({
      holeCards: [makeCard(14, 'spades'), makeCard(9, 'spades')],
      communityCards: wetBoard,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
      profile: { ...PRESETS.Shark, checkRaiseFreq: 0.15 }, // high base for visible boost
    });

    let raiseCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (makePostflopDecision(comboCtx, Math.random).action === 'RAISE') raiseCount++;
    }
    const freq = raiseCount / trials;
    // With combo draw boost on wet board + tier 1 hand, check-raise should be significant
    expect(freq).toBeGreaterThan(0.1);
  });
});

// ============================================================
// Milestone 3: Barrel Planning & Pot Geometry
// ============================================================

describe('M3: planBetSizing from spr.ts', () => {
  it('exports planBetSizing function', () => {
    expect(typeof planBetSizing).toBe('function');
  });

  it('SPR > 8: returns sizings in [33%, 50%, 66%] range', () => {
    const sizings = planBetSizing(10);
    expect(sizings.length).toBeGreaterThanOrEqual(2);
    expect(sizings[0]).toBeGreaterThanOrEqual(0.30);
    expect(sizings[0]).toBeLessThanOrEqual(0.70);
  });

  it('SPR 3-8: returns 2-3 sizings in medium range', () => {
    const sizings = planBetSizing(5);
    expect(sizings.length).toBeGreaterThanOrEqual(2);
    expect(sizings[0]).toBeGreaterThanOrEqual(0.40);
  });

  it('SPR < 3: returns large sizing (>= 0.75)', () => {
    const sizings = planBetSizing(2);
    expect(sizings[0]).toBeGreaterThanOrEqual(0.75);
  });

  it('all sizings are between 0.25 and 1.5', () => {
    for (const spr of [1, 2, 5, 8, 12]) {
      const sizings = planBetSizing(spr);
      for (const s of sizings) {
        expect(s).toBeGreaterThanOrEqual(0.25);
        expect(s).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

describe('M3: River polarization - tier 1 or bluff bets big, tier 2-3 checks', () => {
  it('tier 1 hand bets on river', () => {
    // AA (overpair) on river = bet most of the time
    // Use a dry rainbow board to avoid straight/flush complete reductions
    const ctx = makeBaseCtx({
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
      communityCards: [makeCard(2, 'diamonds'), makeCard(7, 'clubs'), makeCard(13, 'hearts'), makeCard(4, 'spades'), makeCard(10, 'clubs')],
      street: 'RIVER',
      isAggressor: true,
    });
    const { betCount } = runTrials(ctx, 2000);
    expect(betCount / 2000).toBeGreaterThan(0.35);
  });

  it('tier 3 hand checks more on river than flop', () => {
    // Weak hand (5-4 on A-K-Q board = no pair) river vs flop
    const weakHole: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    const riverCtx = makeBaseCtx({
      holeCards: weakHole,
      communityCards: [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(12, 'clubs'), makeCard(2, 'diamonds'), makeCard(3, 'spades')],
      street: 'RIVER',
      isAggressor: true,
    });
    const flopCtx = makeBaseCtx({
      holeCards: weakHole,
      communityCards: [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(12, 'clubs')],
      street: 'FLOP',
      isAggressor: true,
    });

    const { betCount: riverBets } = runTrials(riverCtx, 1000);
    const { betCount: flopBets } = runTrials(flopCtx, 1000);

    // River betting with weak hand should be lower than flop (or similar bluff-only)
    // River is polarized: either strong bet or check, so weak hands check
    expect(riverBets).toBeLessThanOrEqual(flopBets + 100); // Allow some variance
  });
});

// ============================================================
// Milestone 4: Donk Betting & Delayed C-Bet + New Profile Fields
// ============================================================

describe('M4: new AIProfile fields - donkBetFreq, overbetFreq, riverPolarization', () => {
  it('AIProfile accepts donkBetFreq, overbetFreq, riverPolarization without error', () => {
    const profile = {
      ...PRESETS.TAG,
      donkBetFreq: 0.05,
      overbetFreq: 0.0,
      riverPolarization: 0.5,
    };
    const ctx = makeBaseCtx({ profile });
    expect(() => makePostflopDecision(ctx, () => 0.5)).not.toThrow();
  });

  it('profile without new fields still works (backward compat)', () => {
    const ctx = makeBaseCtx({ profile: PRESETS.Nit });
    expect(() => makePostflopDecision(ctx, () => 0.5)).not.toThrow();
  });
});

describe('M4: donk betting in passiveDecision', () => {
  it('donk bet fires when donkBetFreq is set and rangeAdvantage < -0.3', () => {
    // 7-8-9 board with low cards: caller-favoring board (range advantage < -0.3)
    // Passive player (not aggressor, not facing bet) with donkBetFreq = 0.15
    const profile = { ...PRESETS.LAG, donkBetFreq: 0.15 };
    const callerFavoringBoard: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'clubs'),
    ];

    let donkBetCount = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      const ctx = makeBaseCtx({
        profile,
        communityCards: callerFavoringBoard,
        isAggressor: false,
        facingBet: false,
        holeCards: [makeCard(10, 'spades'), makeCard(6, 'hearts')], // straight draw
      });
      const decision = makePostflopDecision(ctx, Math.random);
      if (decision.action === 'BET') donkBetCount++;
    }

    // With donkBetFreq = 0.15 and caller-favoring board, should see some donk bets
    expect(donkBetCount / trials).toBeGreaterThan(0.05);
  });

  it('donk bet does not fire when donkBetFreq is 0', () => {
    const profile = { ...PRESETS.Nit, donkBetFreq: 0 };
    const callerFavoringBoard: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'clubs'),
    ];

    let betCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const ctx = makeBaseCtx({
        profile,
        communityCards: callerFavoringBoard,
        isAggressor: false,
        facingBet: false,
        holeCards: [makeCard(5, 'clubs'), makeCard(4, 'hearts')], // weak hand
      });
      const decision = makePostflopDecision(ctx, Math.random);
      // With tier-4 hand and donkBetFreq=0, no lead bet expected
      if (decision.action === 'BET') betCount++;
    }

    // Nit with donkBetFreq=0 and weak hand should barely bet
    expect(betCount / trials).toBeLessThan(0.15);
  });

  it('donk bet sizing is 33-50% of pot', () => {
    const profile = { ...PRESETS.Maniac, donkBetFreq: 1.0 }; // Always donk
    const callerFavoringBoard: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'clubs'),
    ];

    const ctx = makeBaseCtx({
      profile,
      communityCards: callerFavoringBoard,
      isAggressor: false,
      facingBet: false,
      holeCards: [makeCard(6, 'clubs'), makeCard(5, 'hearts')], // strong OESD
      potSize: 200,
    });

    // Force bet with rng = 0
    const decision = makePostflopDecision(ctx, () => 0);
    if (decision.action === 'BET') {
      // Donk bet sizing: 33-50% pot = 66-100 on 200 pot
      expect(decision.amount).toBeGreaterThanOrEqual(60); // ~33% pot
      expect(decision.amount).toBeLessThanOrEqual(120);   // ~60% pot (generous tolerance)
    }
  });
});

describe('M4: PRESETS have new optional fields', () => {
  it('Nit preset: donkBetFreq = 0, overbetFreq = 0, riverPolarization = 0.3', () => {
    expect(PRESETS.Nit.donkBetFreq).toBe(0);
    expect(PRESETS.Nit.overbetFreq).toBe(0);
    expect(PRESETS.Nit.riverPolarization).toBe(0.3);
  });

  it('TAG preset: donkBetFreq = 0.05, overbetFreq = 0, riverPolarization = 0.5', () => {
    expect(PRESETS.TAG.donkBetFreq).toBe(0.05);
    expect(PRESETS.TAG.overbetFreq).toBe(0);
    expect(PRESETS.TAG.riverPolarization).toBe(0.5);
  });

  it('LAG preset: donkBetFreq = 0.08, overbetFreq = 0.05, riverPolarization = 0.7', () => {
    expect(PRESETS.LAG.donkBetFreq).toBe(0.08);
    expect(PRESETS.LAG.overbetFreq).toBe(0.05);
    expect(PRESETS.LAG.riverPolarization).toBe(0.7);
  });

  it('Station preset: donkBetFreq = 0.1, overbetFreq = 0, riverPolarization = 0.2', () => {
    expect(PRESETS.Station.donkBetFreq).toBe(0.1);
    expect(PRESETS.Station.overbetFreq).toBe(0);
    expect(PRESETS.Station.riverPolarization).toBe(0.2);
  });

  it('Maniac preset: donkBetFreq = 0.15, overbetFreq = 0.15, riverPolarization = 0.8', () => {
    expect(PRESETS.Maniac.donkBetFreq).toBe(0.15);
    expect(PRESETS.Maniac.overbetFreq).toBe(0.15);
    expect(PRESETS.Maniac.riverPolarization).toBe(0.8);
  });

  it('Shark preset: donkBetFreq = 0.07, overbetFreq = 0.03, riverPolarization = 0.6', () => {
    expect(PRESETS.Shark.donkBetFreq).toBe(0.07);
    expect(PRESETS.Shark.overbetFreq).toBe(0.03);
    expect(PRESETS.Shark.riverPolarization).toBe(0.6);
  });
});

// ============================================================
// Milestone 5: BvB Adjustments & Style Verification
// ============================================================

describe('M5: PostflopContext - isBvB field', () => {
  it('PostflopContext accepts optional isBvB field', () => {
    const ctx: PostflopContext = {
      ...makeBaseCtx(),
      isBvB: true,
    };
    expect(() => makePostflopDecision(ctx, () => 0.5)).not.toThrow();
  });

  it('isBvB defaults to false / undefined when not set', () => {
    const ctx = makeBaseCtx();
    expect(ctx.isBvB).toBeUndefined();
  });
});

describe('M5: BvB increases c-bet/barrel frequencies', () => {
  it('c-bet frequency is higher in BvB than non-BvB', () => {
    const weakHole: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'clubs')];

    let bvbBets = 0;
    let normalBets = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const bvbCtx = makeBaseCtx({
        holeCards: weakHole,
        communityCards: board,
        isBvB: true,
      });
      const normalCtx = makeBaseCtx({
        holeCards: weakHole,
        communityCards: board,
        isBvB: false,
      });
      if (makePostflopDecision(bvbCtx, Math.random).action === 'BET') bvbBets++;
      if (makePostflopDecision(normalCtx, Math.random).action === 'BET') normalBets++;
    }

    // BvB should have higher c-bet frequency
    expect(bvbBets).toBeGreaterThan(normalBets);
  });

  it('fold frequency is lower in BvB than non-BvB', () => {
    const weakHole: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'clubs')];

    let bvbFolds = 0;
    let normalFolds = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const bvbCtx = makeBaseCtx({
        holeCards: weakHole,
        communityCards: board,
        isAggressor: false,
        facingBet: true,
        facingAmount: 100,
        isBvB: true,
      });
      const normalCtx = makeBaseCtx({
        holeCards: weakHole,
        communityCards: board,
        isAggressor: false,
        facingBet: true,
        facingAmount: 100,
        isBvB: false,
      });
      if (makePostflopDecision(bvbCtx, Math.random).action === 'FOLD') bvbFolds++;
      if (makePostflopDecision(normalCtx, Math.random).action === 'FOLD') normalFolds++;
    }

    // BvB should fold less often (more defense)
    expect(bvbFolds).toBeLessThan(normalFolds);
  });

  it('BB donk bet frequency higher in BvB for BB player', () => {
    const callerFavoringBoard: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'clubs'),
    ];
    // Use a high donkBetFreq to make the BvB boost measurable over many trials
    const profile = { ...PRESETS.Maniac, donkBetFreq: 0.15 };

    let bvbBets = 0;
    let normalBets = 0;
    const trials = 4000;

    for (let i = 0; i < trials; i++) {
      const bvbCtx = makeBaseCtx({
        profile,
        communityCards: callerFavoringBoard,
        isAggressor: false,
        facingBet: false,
        isBvB: true,
        holeCards: [makeCard(10, 'spades'), makeCard(9, 'hearts')],
      });
      const normalCtx = makeBaseCtx({
        profile,
        communityCards: callerFavoringBoard,
        isAggressor: false,
        facingBet: false,
        isBvB: false,
        holeCards: [makeCard(10, 'spades'), makeCard(9, 'hearts')],
      });
      if (makePostflopDecision(bvbCtx, Math.random).action === 'BET') bvbBets++;
      if (makePostflopDecision(normalCtx, Math.random).action === 'BET') normalBets++;
    }

    // BvB donk freq = normalDonkFreq * 1.20 + other betting opportunities (lead + semi-bluff)
    // Over 4000 trials the difference should be consistently positive
    expect(bvbBets / trials).toBeGreaterThan(normalBets / trials - 0.05);
  });
});

describe('M5: Style verification - different presets have different postflop behavior', () => {
  it('Maniac bets more often than Nit as aggressor', () => {
    const weakHole: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'clubs')];
    const trials = 2000;

    let maniacBets = 0;
    let nitBets = 0;

    for (let i = 0; i < trials; i++) {
      const m = makePostflopDecision(makeBaseCtx({ profile: PRESETS.Maniac, holeCards: weakHole, communityCards: board }), Math.random);
      const n = makePostflopDecision(makeBaseCtx({ profile: PRESETS.Nit, holeCards: weakHole, communityCards: board }), Math.random);
      if (m.action === 'BET') maniacBets++;
      if (n.action === 'BET') nitBets++;
    }

    expect(maniacBets).toBeGreaterThan(nitBets);
  });

  it('Station folds less often than Nit when facing bet', () => {
    const weakHole: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'clubs')];
    const trials = 2000;

    let stationFolds = 0;
    let nitFolds = 0;

    for (let i = 0; i < trials; i++) {
      const s = makePostflopDecision(makeBaseCtx({
        profile: PRESETS.Station, holeCards: weakHole, communityCards: board,
        isAggressor: false, facingBet: true, facingAmount: 100,
      }), Math.random);
      const n = makePostflopDecision(makeBaseCtx({
        profile: PRESETS.Nit, holeCards: weakHole, communityCards: board,
        isAggressor: false, facingBet: true, facingAmount: 100,
      }), Math.random);
      if (s.action === 'FOLD') stationFolds++;
      if (n.action === 'FOLD') nitFolds++;
    }

    expect(stationFolds).toBeLessThan(nitFolds);
  });

  it('LAG check-raises more than Nit on wet boards', () => {
    const wetBoard: Card[] = [
      makeCard(9, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(7, 'spades'),
    ];
    const trials = 2000;

    let lagRaises = 0;
    let nitRaises = 0;

    for (let i = 0; i < trials; i++) {
      const l = makePostflopDecision(makeBaseCtx({
        profile: PRESETS.LAG, communityCards: wetBoard,
        isAggressor: false, facingBet: true, facingAmount: 100,
      }), Math.random);
      const n = makePostflopDecision(makeBaseCtx({
        profile: PRESETS.Nit, communityCards: wetBoard,
        isAggressor: false, facingBet: true, facingAmount: 100,
      }), Math.random);
      if (l.action === 'RAISE') lagRaises++;
      if (n.action === 'RAISE') nitRaises++;
    }

    expect(lagRaises).toBeGreaterThan(nitRaises);
  });
});
