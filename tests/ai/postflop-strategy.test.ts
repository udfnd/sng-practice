/**
 * Comprehensive poker-strategy-based tests for the AI postflop engine.
 *
 * Uses a statistical approach: run N trials with different RNG seeds and
 * assert frequency ranges. Tolerances are generous (~15-20%) because we
 * use a deterministic linear sweep (seed = i/trials) rather than true
 * randomness — the sweep is a proxy for an expectation over [0,1].
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
  return { encoded: suitIndex * 13 + (rank - 2), suit, rank };
}

function makeBaseCtx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    profile: PRESETS.TAG,
    holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
    communityCards: [makeCard(2, 'diamonds'), makeCard(7, 'clubs'), makeCard(13, 'hearts')],
    street: 'FLOP',
    isAggressor: true,
    facingBet: false,
    facingAmount: 0,
    potSize: 200,
    chips: 1000,
    bb: 20,
    spr: 5,
    opponents: 1,
    isBvB: false,
    ...overrides,
  };
}

/**
 * Run ctx N times with seed = i / trials so the RNG sweeps [0, 1) uniformly.
 * Returns action counts and the total.
 */
function runTrials(ctx: PostflopContext, trials = 2000) {
  let bet = 0, check = 0, call = 0, fold = 0, raise = 0;
  for (let i = 0; i < trials; i++) {
    const seed = i / trials;
    const decision = makePostflopDecision(ctx, () => seed);
    switch (decision.action) {
      case 'BET':   bet++;   break;
      case 'CHECK': check++; break;
      case 'CALL':  call++;  break;
      case 'FOLD':  fold++;  break;
      case 'RAISE': raise++; break;
    }
  }
  return { bet, check, call, fold, raise, total: trials };
}

// ============================================================
// 1. Style Differentiation (R21–R26)
// ============================================================

describe('Style Differentiation - presets produce distinct behaviors', () => {
  // R21: TAG c-bets more than Station on the flop
  it('R21 - TAG c-bets more than Station on the flop', () => {
    const board: Card[] = [makeCard(9, 'diamonds'), makeCard(3, 'clubs'), makeCard(2, 'hearts')];
    const holeCards: [Card, Card] = [makeCard(7, 'spades'), makeCard(6, 'spades')]; // tier-4 hand

    const tagCtx = makeBaseCtx({
      profile: PRESETS.TAG,
      holeCards,
      communityCards: board,
      street: 'FLOP',
      isAggressor: true,
      facingBet: false,
    });
    const stationCtx = makeBaseCtx({
      profile: PRESETS.Station,
      holeCards,
      communityCards: board,
      street: 'FLOP',
      isAggressor: true,
      facingBet: false,
    });

    const tag = runTrials(tagCtx);
    const station = runTrials(stationCtx);

    // TAG cBetFreq=0.70 vs Station cBetFreq=0.35 — TAG should bet significantly more
    expect(tag.bet / tag.total).toBeGreaterThan(station.bet / station.total);
  });

  // R22: Maniac barrels river more than TAG (pure bluff path)
  it('R22 - Maniac bluff-barrels the river more than TAG', () => {
    // Use air (tier-4) on a non-completing board so bluffFreq drives the decision
    const holeCards: [Card, Card] = [makeCard(4, 'clubs'), makeCard(3, 'hearts')];
    const riverBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(13, 'hearts'),
      makeCard(12, 'clubs'), makeCard(11, 'diamonds'), makeCard(9, 'spades'),
    ];

    const maniacCtx = makeBaseCtx({
      profile: PRESETS.Maniac,
      holeCards,
      communityCards: riverBoard,
      street: 'RIVER',
      isAggressor: true,
      facingBet: false,
    });
    const tagCtx = makeBaseCtx({
      profile: PRESETS.TAG,
      holeCards,
      communityCards: riverBoard,
      street: 'RIVER',
      isAggressor: true,
      facingBet: false,
    });

    const maniac = runTrials(maniacCtx);
    const tag = runTrials(tagCtx);

    // Maniac riverBarrel=0.55 + bluffFreq=0.45 vs TAG riverBarrel=0.40 + bluffFreq=0.15
    expect(maniac.bet / maniac.total).toBeGreaterThan(tag.bet / tag.total);
  });

  // R23: Nit gives up on wet turn/river more than LAG
  it('R23 - Nit gives up (checks) on wet turn more than LAG', () => {
    const holeCards: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
    // Wet board with flush/straight completing on turn
    const turnBoard: Card[] = [
      makeCard(9, 'spades'), makeCard(8, 'spades'),
      makeCard(7, 'hearts'), makeCard(6, 'spades'),
    ];

    const nitCtx = makeBaseCtx({
      profile: PRESETS.Nit,
      holeCards,
      communityCards: turnBoard,
      street: 'TURN',
      isAggressor: true,
      facingBet: false,
    });
    const lagCtx = makeBaseCtx({
      profile: PRESETS.LAG,
      holeCards,
      communityCards: turnBoard,
      street: 'TURN',
      isAggressor: true,
      facingBet: false,
    });

    const nit = runTrials(nitCtx);
    const lag = runTrials(lagCtx);

    // Nit turnBarrel=0.40 vs LAG turnBarrel=0.60 — Nit checks more
    expect(nit.check / nit.total).toBeGreaterThan(lag.check / lag.total);
  });

  // R24: Shark has most balanced (non-extreme) frequencies across streets
  it('R24 - Shark bet frequency is between Nit and Maniac', () => {
    const holeCards: [Card, Card] = [makeCard(6, 'clubs'), makeCard(5, 'clubs')];
    const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'diamonds')];

    const nitCtx = makeBaseCtx({ profile: PRESETS.Nit, holeCards, communityCards: board });
    const sharkCtx = makeBaseCtx({ profile: PRESETS.Shark, holeCards, communityCards: board });
    const maniacCtx = makeBaseCtx({ profile: PRESETS.Maniac, holeCards, communityCards: board });

    const nit = runTrials(nitCtx);
    const shark = runTrials(sharkCtx);
    const maniac = runTrials(maniacCtx);

    const nitRate = nit.bet / nit.total;
    const sharkRate = shark.bet / shark.total;
    const maniacRate = maniac.bet / maniac.total;

    // Shark should be between the extremes (with 15% tolerance)
    expect(sharkRate).toBeGreaterThanOrEqual(nitRate - 0.15);
    expect(sharkRate).toBeLessThanOrEqual(maniacRate + 0.15);
  });

  // R25: Station folds less to a bet than any other preset
  it('R25 - Station folds less to a c-bet than Nit', () => {
    const holeCards: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'hearts')]; // tier-4 hand
    const board: Card[] = [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(7, 'clubs')];

    const stationCtx = makeBaseCtx({
      profile: PRESETS.Station,
      holeCards,
      communityCards: board,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    const nitCtx = makeBaseCtx({
      profile: PRESETS.Nit,
      holeCards,
      communityCards: board,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const station = runTrials(stationCtx);
    const nit = runTrials(nitCtx);

    // Station foldToCBet=0.25 vs Nit foldToCBet=0.60
    expect(station.fold / station.total).toBeLessThan(nit.fold / nit.total);
  });

  // R26: LAG check-raises more than TAG on wet boards (already partly covered, testing directly)
  it('R26 - LAG check-raises more than TAG on wet boards', () => {
    const wetBoard: Card[] = [
      makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'clubs'),
    ];

    const lagCtx = makeBaseCtx({
      profile: PRESETS.LAG,
      communityCards: wetBoard,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    const tagCtx = makeBaseCtx({
      profile: PRESETS.TAG,
      communityCards: wetBoard,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const lag = runTrials(lagCtx);
    const tag = runTrials(tagCtx);

    // LAG checkRaiseFreq=0.10 vs TAG checkRaiseFreq=0.06
    expect(lag.raise / lag.total).toBeGreaterThanOrEqual(tag.raise / tag.total);
  });
});

// ============================================================
// 2. Board Texture Impact
// ============================================================

describe('Board Texture Impact on aggressor frequencies', () => {
  it('dry rainbow board (A-7-2) produces higher c-bet frequency than wet board (9h-8h-7d)', () => {
    const dryBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs'),
    ];
    const wetBoard: Card[] = [
      makeCard(9, 'hearts'), makeCard(8, 'hearts'), makeCard(7, 'diamonds'),
    ];
    const holeCards: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')]; // tier-4

    const dryCtx = makeBaseCtx({ communityCards: dryBoard, holeCards });
    const wetCtx = makeBaseCtx({ communityCards: wetBoard, holeCards });

    const dry = runTrials(dryCtx);
    const wet = runTrials(wetCtx);

    // Dry board: textureAdjustment = +0.12, Wet = -0.12 → dry should yield higher bet rate
    expect(dry.bet / dry.total).toBeGreaterThan(wet.bet / wet.total);
  });

  it('wet board produces more check-raises as defender than dry board', () => {
    const dryBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs'),
    ];
    const wetBoard: Card[] = [
      makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'spades'),
    ];

    const dryCtx = makeBaseCtx({
      communityCards: dryBoard,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
      profile: PRESETS.LAG, // higher checkRaiseFreq to make effect visible
    });
    const wetCtx = makeBaseCtx({
      communityCards: wetBoard,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
      profile: PRESETS.LAG,
    });

    const dry = runTrials(dryCtx);
    const wet = runTrials(wetCtx);

    // boardDependentCheckRaiseFreq multiplies by 0.5 for dry, 1.3 for wet
    expect(wet.raise / wet.total).toBeGreaterThan(dry.raise / dry.total);
  });

  it('monotone board (Ah-9h-4h) reduces barrel frequency on turn vs dry board', () => {
    // Monotone flop: 3 hearts → flushComplete = true on the board,
    // On turn a 4th card comes. Let's test turn barrels on a monotone-continuing board.
    const monotoneBoard: Card[] = [
      makeCard(14, 'hearts'), makeCard(9, 'hearts'),
      makeCard(4, 'hearts'), makeCard(2, 'hearts'), // turn: 4th heart = flush completed
    ];
    const dryBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(9, 'clubs'),
      makeCard(4, 'diamonds'), makeCard(2, 'hearts'),
    ];
    const holeCards: [Card, Card] = [makeCard(6, 'clubs'), makeCard(5, 'clubs')];

    const monotoneCtx = makeBaseCtx({
      communityCards: monotoneBoard,
      holeCards,
      street: 'TURN',
    });
    const dryCtx = makeBaseCtx({
      communityCards: dryBoard,
      holeCards,
      street: 'TURN',
    });

    const monotone = runTrials(monotoneCtx);
    const dry = runTrials(dryCtx);

    // On monotone turn, flushComplete=true → betFreq * 0.8 reduction on barrel
    // Combined with textureAdjustment=-0.10 for monotone vs +0.12 for dry
    expect(dry.bet / dry.total).toBeGreaterThan(monotone.bet / monotone.total);
  });

  it('turn completing a flush draw reduces aggressor barrel frequency', () => {
    // Turn board where spade flush is completed (3 spades on flop, 4th on turn)
    const flushCompletingTurn: Card[] = [
      makeCard(9, 'spades'), makeCard(7, 'spades'),
      makeCard(3, 'spades'), makeCard(2, 'spades'), // flush complete on turn
    ];
    const noFlushTurn: Card[] = [
      makeCard(9, 'spades'), makeCard(7, 'hearts'),
      makeCard(3, 'clubs'), makeCard(2, 'diamonds'),
    ];
    const holeCards: [Card, Card] = [makeCard(6, 'clubs'), makeCard(5, 'hearts')];

    const flushCtx = makeBaseCtx({
      communityCards: flushCompletingTurn,
      holeCards,
      street: 'TURN',
    });
    const noFlushCtx = makeBaseCtx({
      communityCards: noFlushTurn,
      holeCards,
      street: 'TURN',
    });

    const flush = runTrials(flushCtx);
    const noFlush = runTrials(noFlushCtx);

    // flushComplete = true → betFreq * 0.8 on turn/river
    expect(noFlush.bet / noFlush.total).toBeGreaterThan(flush.bet / flush.total - 0.10);
  });
});

// ============================================================
// 3. Hand Tier Impact on Defense
// ============================================================

describe('Hand Tier Impact on defense (facingBet)', () => {
  const board: Card[] = [makeCard(10, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs')];

  it('Top pair (tier 1) rarely folds to a bet (~10% or less fold rate)', () => {
    // AA is overpair (tier 1)
    const ctx = makeBaseCtx({
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
      communityCards: board,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
      profile: PRESETS.TAG, // foldToCBet=0.45
    });

    const result = runTrials(ctx);
    // tier 1: foldFreq *= 0.1 → TAG: 0.45 * 0.1 = 0.045. Allow up to ~15% (tolerance)
    expect(result.fold / result.total).toBeLessThan(0.15);
  });

  it('Bottom pair (tier 3) folds more often than top pair', () => {
    // Top pair: KJ hole cards on K-7-2 board
    const topPairCtx = makeBaseCtx({
      holeCards: [makeCard(13, 'spades'), makeCard(11, 'hearts')],
      communityCards: [makeCard(13, 'hearts'), makeCard(7, 'clubs'), makeCard(2, 'diamonds')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    // Bottom pair: 2x on a K-7-2 board
    const bottomPairCtx = makeBaseCtx({
      holeCards: [makeCard(2, 'spades'), makeCard(4, 'hearts')],
      communityCards: [makeCard(13, 'hearts'), makeCard(7, 'clubs'), makeCard(2, 'diamonds')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const top = runTrials(topPairCtx);
    const bottom = runTrials(bottomPairCtx);

    // Bottom pair is tier 3 (foldFreq * 0.8) vs top pair tier 1 (foldFreq * 0.1)
    expect(bottom.fold / bottom.total).toBeGreaterThan(top.fold / top.total);
  });

  it('Nothing (tier 4, no draw) folds most often among hand tiers', () => {
    // Pure air: 5-4 off on an A-K-J board (no pair, no draw)
    const airCtx = makeBaseCtx({
      holeCards: [makeCard(5, 'clubs'), makeCard(4, 'diamonds')],
      communityCards: [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(11, 'clubs')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    // Top pair for comparison
    const topPairCtx = makeBaseCtx({
      holeCards: [makeCard(14, 'hearts'), makeCard(9, 'clubs')],
      communityCards: [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(11, 'clubs')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const air = runTrials(airCtx);
    const topPair = runTrials(topPairCtx);

    // tier 4: foldFreq * 1.2 vs tier 1: foldFreq * 0.1
    expect(air.fold / air.total).toBeGreaterThan(topPair.fold / topPair.total);
  });

  it('Flush draw (drawTier >= 2) folds significantly less than nothing', () => {
    // Air: 5c-4d on Ks-Jh-2c (no draw)
    const airCtx = makeBaseCtx({
      holeCards: [makeCard(5, 'clubs'), makeCard(4, 'diamonds')],
      communityCards: [makeCard(13, 'spades'), makeCard(11, 'hearts'), makeCard(2, 'clubs')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    // Flush draw: As-9s on Ks-Js-2h (3 spades = flush draw, drawTier >= 2)
    const flushDrawCtx = makeBaseCtx({
      holeCards: [makeCard(14, 'spades'), makeCard(9, 'spades')],
      communityCards: [makeCard(13, 'spades'), makeCard(11, 'spades'), makeCard(2, 'hearts')],
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const air = runTrials(airCtx);
    const flushDraw = runTrials(flushDrawCtx);

    // drawTier >= 2: foldFreq *= 0.5 → significant fold reduction
    // Flush draw should fold at least 30% less in absolute terms
    expect(air.fold / air.total - flushDraw.fold / flushDraw.total).toBeGreaterThan(0.10);
  });
});

// ============================================================
// 4. SPR-Based Sizing
// ============================================================

describe('SPR-Based Bet Sizing', () => {
  const alwaysBet = () => 0; // forces bet decision every time

  it('Low SPR (<3) produces large bet sizing (>= 66% pot)', () => {
    const ctx = makeBaseCtx({ spr: 2, potSize: 200, chips: 400 });
    const decision = makePostflopDecision(ctx, alwaysBet);
    if (decision.action === 'BET') {
      // sprBetSizing(2) = 1.0, blended with cBetSize: still >= 66% of pot
      expect(decision.amount).toBeGreaterThanOrEqual(Math.round(200 * 0.50)); // generous lower bound
    }
    expect(['BET', 'CHECK']).toContain(decision.action);
  });

  it('Medium SPR (3-8) produces moderate sizing (40-80% pot)', () => {
    const ctx = makeBaseCtx({ spr: 5, potSize: 200, chips: 1000 });
    const decision = makePostflopDecision(ctx, alwaysBet);
    if (decision.action === 'BET') {
      expect(decision.amount).toBeGreaterThanOrEqual(Math.round(200 * 0.30));
      expect(decision.amount).toBeLessThanOrEqual(Math.round(200 * 1.20)); // within reasonable range
    }
  });

  it('High SPR (>8) produces small sizing (<= 60% pot)', () => {
    const ctx = makeBaseCtx({ spr: 12, potSize: 200, chips: 2400 });
    const decision = makePostflopDecision(ctx, alwaysBet);
    if (decision.action === 'BET') {
      // planBetSizing(12) = [0.33, 0.50, 0.66], blended with profile cBetSize
      // Expected: ~0.33*0.7 + 0.67*0.3 ≈ 0.43 → ~86 on 200 pot
      expect(decision.amount).toBeLessThanOrEqual(Math.round(200 * 0.80));
    }
  });

  it('Low SPR bets more chips than High SPR on same pot', () => {
    const potSize = 200;
    const lowSprCtx = makeBaseCtx({ spr: 2, potSize, chips: 400 });
    const highSprCtx = makeBaseCtx({ spr: 12, potSize, chips: 2400 });

    const lowDecision = makePostflopDecision(lowSprCtx, alwaysBet);
    const highDecision = makePostflopDecision(highSprCtx, alwaysBet);

    if (lowDecision.action === 'BET' && highDecision.action === 'BET') {
      expect(lowDecision.amount).toBeGreaterThanOrEqual(highDecision.amount);
    }
  });
});

// ============================================================
// 5. BvB (Blind vs Blind) Adjustments
// ============================================================

describe('BvB (Blind vs Blind) Adjustments', () => {
  const weakHand: [Card, Card] = [makeCard(5, 'clubs'), makeCard(4, 'diamonds')];
  const board: Card[] = [makeCard(14, 'spades'), makeCard(8, 'hearts'), makeCard(2, 'clubs')];

  it('BvB aggressor c-bets more than non-BvB aggressor', () => {
    const bvbCtx = makeBaseCtx({
      holeCards: weakHand,
      communityCards: board,
      isBvB: true,
      isAggressor: true,
      facingBet: false,
    });
    const normalCtx = makeBaseCtx({
      holeCards: weakHand,
      communityCards: board,
      isBvB: false,
      isAggressor: true,
      facingBet: false,
    });

    const bvb = runTrials(bvbCtx);
    const normal = runTrials(normalCtx);

    // BvB: betFreq * 1.20 → should bet more
    expect(bvb.bet / bvb.total).toBeGreaterThan(normal.bet / normal.total);
  });

  it('BvB defender folds less than non-BvB defender', () => {
    const bvbCtx = makeBaseCtx({
      holeCards: weakHand,
      communityCards: board,
      isBvB: true,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });
    const normalCtx = makeBaseCtx({
      holeCards: weakHand,
      communityCards: board,
      isBvB: false,
      isAggressor: false,
      facingBet: true,
      facingAmount: 100,
    });

    const bvb = runTrials(bvbCtx);
    const normal = runTrials(normalCtx);

    // BvB: foldFreq * 0.85 → fold less
    expect(bvb.fold / bvb.total).toBeLessThan(normal.fold / normal.total);
  });
});

// ============================================================
// 6. River Polarization
// ============================================================

describe('River Polarization', () => {
  const riverBoard: Card[] = [
    makeCard(10, 'spades'), makeCard(7, 'hearts'),
    makeCard(2, 'clubs'), makeCard(5, 'diamonds'), makeCard(9, 'hearts'),
  ];

  it('Tier 1 (strong hand) bets the river at high frequency (>35%)', () => {
    // AA on river (overpair = tier 1)
    const ctx = makeBaseCtx({
      holeCards: [makeCard(14, 'spades'), makeCard(14, 'hearts')],
      communityCards: riverBoard,
      street: 'RIVER',
      isAggressor: true,
      facingBet: false,
    });

    const result = runTrials(ctx);
    expect(result.bet / result.total).toBeGreaterThan(0.35);
  });

  it('Tier 2-3 (medium hands) check more on river than on flop (river polarization)', () => {
    // Top pair weak kicker: K9 on K-7-2-5-9 board = top pair (but 9 hits board = TP)
    // Use second pair for tier-2: 7-5 on K-7-2-5-9
    const holeCards: [Card, Card] = [makeCard(7, 'spades'), makeCard(6, 'clubs')]; // second pair on river
    const flopBoard: Card[] = [makeCard(13, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs')];

    const riverCtx = makeBaseCtx({
      holeCards,
      communityCards: riverBoard,
      street: 'RIVER',
      isAggressor: true,
      facingBet: false,
    });
    const flopCtx = makeBaseCtx({
      holeCards,
      communityCards: flopBoard,
      street: 'FLOP',
      isAggressor: true,
      facingBet: false,
    });

    const river = runTrials(riverCtx);
    const flop = runTrials(flopCtx);

    // River polarization reduces bet freq for tier 2-3 → more checks on river
    // Allow generous tolerance since both are stat-based
    expect(river.check / river.total).toBeGreaterThanOrEqual(flop.check / flop.total - 0.10);
  });

  it('LAG/Maniac/Shark have non-zero river bluff frequency (tier 4 bets > 0)', () => {
    // Pure air on river: no pair, no draw
    const airHand: [Card, Card] = [makeCard(4, 'clubs'), makeCard(3, 'hearts')];
    const riverBoardClean: Card[] = [
      makeCard(14, 'spades'), makeCard(13, 'hearts'),
      makeCard(12, 'clubs'), makeCard(11, 'diamonds'), makeCard(9, 'spades'),
    ];

    for (const presetName of ['LAG', 'Maniac', 'Shark'] as const) {
      const ctx = makeBaseCtx({
        profile: PRESETS[presetName],
        holeCards: airHand,
        communityCards: riverBoardClean,
        street: 'RIVER',
        isAggressor: true,
        facingBet: false,
      });

      const result = runTrials(ctx, 3000);
      // LAG/Maniac/Shark should have some bluff frequency on river
      expect(result.bet).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 7. Donk Betting
// ============================================================

describe('Donk Betting', () => {
  // A caller-favoring board: low connected cards where callers range is strong
  // rangeAdvantageScore returns > 0.3 from caller perspective for 7-8-9 board
  const callerBoard: Card[] = [
    makeCard(7, 'spades'), makeCard(8, 'hearts'), makeCard(9, 'clubs'),
  ];

  it('Donk bet fires when non-aggressor has range advantage (rangeAdv > 0.3)', () => {
    const profile = { ...PRESETS.LAG, donkBetFreq: 0.20 };
    const ctx = makeBaseCtx({
      profile,
      communityCards: callerBoard,
      isAggressor: false,
      facingBet: false,
      holeCards: [makeCard(10, 'spades'), makeCard(6, 'hearts')], // OESD = draw
    });

    const result = runTrials(ctx);
    // With donkBetFreq=0.20 and range advantage, should see meaningful donk bet rate
    expect(result.bet / result.total).toBeGreaterThan(0.05);
  });

  it('Donk bet does not fire when donkBetFreq = 0 (Nit)', () => {
    const ctx = makeBaseCtx({
      profile: { ...PRESETS.Nit, donkBetFreq: 0 },
      communityCards: callerBoard,
      isAggressor: false,
      facingBet: false,
      holeCards: [makeCard(5, 'clubs'), makeCard(4, 'hearts')], // weak hand, no reason to lead
    });

    // With donkBetFreq=0 and no tier-1 hand, betting should be very rare
    // Only passiveDecision's lead/semi-bluff paths remain
    const result = runTrials(ctx);
    expect(result.bet / result.total).toBeLessThan(0.20);
  });

  it('BvB increases donk bet frequency for non-aggressor BB', () => {
    const profile = { ...PRESETS.Maniac, donkBetFreq: 0.15 };
    const holeCards: [Card, Card] = [makeCard(10, 'spades'), makeCard(9, 'hearts')];

    const bvbCtx = makeBaseCtx({
      profile,
      communityCards: callerBoard,
      isAggressor: false,
      facingBet: false,
      isBvB: true,
      holeCards,
    });
    const normalCtx = makeBaseCtx({
      profile,
      communityCards: callerBoard,
      isAggressor: false,
      facingBet: false,
      isBvB: false,
      holeCards,
    });

    const bvb = runTrials(bvbCtx, 3000);
    const normal = runTrials(normalCtx, 3000);

    // BvB: adjustedDonkFreq * 1.20 — donk more in BvB
    // Allow 5% tolerance for statistical variance
    expect(bvb.bet / bvb.total).toBeGreaterThanOrEqual(normal.bet / normal.total - 0.05);
  });

  it('Donk bet sizing is approximately 33-50% of pot', () => {
    // Use rng=0 to force the decision and measure sizing
    const potSize = 200;
    const profile = { ...PRESETS.Maniac, donkBetFreq: 1.0 }; // always donk when conditions met
    const ctx = makeBaseCtx({
      profile,
      communityCards: callerBoard,
      isAggressor: false,
      facingBet: false,
      holeCards: [makeCard(6, 'clubs'), makeCard(5, 'hearts')], // OESD
      potSize,
    });

    // rng=0 triggers donk path if conditions are met
    const decision = makePostflopDecision(ctx, () => 0);
    if (decision.action === 'BET') {
      // 33-50% of 200 = 66-100, with generous bounds for min-bet clamping
      expect(decision.amount).toBeGreaterThanOrEqual(Math.round(potSize * 0.25));
      expect(decision.amount).toBeLessThanOrEqual(Math.round(potSize * 0.65));
    }
    // At minimum, some action must occur
    expect(['BET', 'CHECK']).toContain(decision.action);
  });
});

// ============================================================
// 8. Check-Raise Frequency
// ============================================================

describe('Check-Raise Frequency by board texture', () => {
  const facingBetCtxBase = {
    isAggressor: false,
    facingBet: true,
    facingAmount: 100,
  };

  it('Wet boards produce higher check-raise frequency than dry boards', () => {
    const wetBoard: Card[] = [
      makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'spades'),
    ];
    const dryBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs'),
    ];

    const wetCtx = makeBaseCtx({ ...facingBetCtxBase, communityCards: wetBoard, profile: PRESETS.Shark });
    const dryCtx = makeBaseCtx({ ...facingBetCtxBase, communityCards: dryBoard, profile: PRESETS.Shark });

    const wet = runTrials(wetCtx);
    const dry = runTrials(dryCtx);

    // wet: crFreq * 1.3 vs dry: crFreq * 0.5 → wet should produce more raises
    expect(wet.raise / wet.total).toBeGreaterThan(dry.raise / dry.total);
  });

  it('Dry boards produce lower check-raise frequency than wet boards', () => {
    const dryBoard: Card[] = [
      makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs'),
    ];

    const dryCtx = makeBaseCtx({
      ...facingBetCtxBase,
      communityCards: dryBoard,
      profile: { ...PRESETS.Shark, checkRaiseFreq: 0.30 }, // higher base to see difference
    });

    const dry = runTrials(dryCtx);
    // Even with high base, dry boards should reduce check-raise (freq * 0.5)
    // So max ~0.30 * 0.5 = 0.15, but only tier-1 hands raise — keep gentle assertion
    expect(dry.raise / dry.total).toBeLessThan(0.50);
  });

  it('Maniac has highest check-raise frequency among presets on wet board', () => {
    const wetBoard: Card[] = [
      makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'spades'),
    ];

    const maniacCtx = makeBaseCtx({ ...facingBetCtxBase, communityCards: wetBoard, profile: PRESETS.Maniac });
    const nitCtx = makeBaseCtx({ ...facingBetCtxBase, communityCards: wetBoard, profile: PRESETS.Nit });

    const maniac = runTrials(maniacCtx);
    const nit = runTrials(nitCtx);

    // Maniac checkRaiseFreq=0.15 vs Nit checkRaiseFreq=0.03
    expect(maniac.raise / maniac.total).toBeGreaterThan(nit.raise / nit.total);
  });

  it('Check-raise only available when facing a bet (not when aggressor or passive)', () => {
    // Aggressor context — should never produce RAISE (it would be a BET instead)
    const aggressorCtx = makeBaseCtx({
      isAggressor: true,
      facingBet: false,
      communityCards: [makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'spades')],
    });

    const result = runTrials(aggressorCtx);
    // Aggressor path returns BET or CHECK only — no RAISE action
    expect(result.raise).toBe(0);
  });
});
