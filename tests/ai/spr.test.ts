import { describe, it, expect } from 'vitest';
import type { Card } from '@/types';
import {
  calculateSPR,
  sprBetSizing,
  rangeAdvantageScore,
  multiwayPenalty,
} from '@/ai/spr';

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

// ============================================================
// calculateSPR
// ============================================================

describe('calculateSPR', () => {
  it('returns stack / pot ratio', () => {
    expect(calculateSPR(1000, 200)).toBeCloseTo(5.0);
  });

  it('returns correct ratio for low SPR scenario', () => {
    expect(calculateSPR(300, 200)).toBeCloseTo(1.5);
  });

  it('returns correct ratio for high SPR scenario', () => {
    expect(calculateSPR(5000, 200)).toBeCloseTo(25.0);
  });

  it('returns Infinity when pot is 0 (edge case)', () => {
    expect(calculateSPR(1000, 0)).toBe(Infinity);
  });

  it('returns 0 when stack is 0', () => {
    expect(calculateSPR(0, 200)).toBe(0);
  });
});

// ============================================================
// sprBetSizing
// ============================================================

describe('sprBetSizing', () => {
  it('returns large sizing (>= 0.8) for very low SPR (< 3)', () => {
    const sizing = sprBetSizing(1.5);
    expect(sizing).toBeGreaterThanOrEqual(0.8);
  });

  it('returns large sizing (>= 0.66) for low SPR (3-6)', () => {
    const sizing = sprBetSizing(4);
    expect(sizing).toBeGreaterThanOrEqual(0.66);
    expect(sizing).toBeLessThanOrEqual(1.0);
  });

  it('returns medium sizing (0.33-0.66) for medium SPR (6-10)', () => {
    const sizing = sprBetSizing(8);
    expect(sizing).toBeGreaterThanOrEqual(0.33);
    expect(sizing).toBeLessThanOrEqual(0.66);
  });

  it('returns small sizing (<= 0.33) for high SPR (> 10)', () => {
    const sizing = sprBetSizing(15);
    expect(sizing).toBeLessThanOrEqual(0.33);
    expect(sizing).toBeGreaterThanOrEqual(0.25);
  });

  it('bet sizing decreases as SPR increases', () => {
    const sizingLow = sprBetSizing(2);
    const sizingMid = sprBetSizing(5);
    const sizingHigh = sprBetSizing(8);
    const sizingVeryHigh = sprBetSizing(15);
    expect(sizingLow).toBeGreaterThan(sizingMid);
    expect(sizingMid).toBeGreaterThan(sizingHigh);
    expect(sizingHigh).toBeGreaterThan(sizingVeryHigh);
  });

  it('returns overbet or near-pot for very short stack (SPR = 1)', () => {
    const sizing = sprBetSizing(1);
    expect(sizing).toBeGreaterThanOrEqual(1.0);
  });

  it('returns 1/3 pot (0.33) for deep stack (SPR = 20)', () => {
    const sizing = sprBetSizing(20);
    expect(sizing).toBeCloseTo(0.33, 1);
  });
});

// ============================================================
// rangeAdvantageScore
// ============================================================

describe('rangeAdvantageScore', () => {
  it('A-K-2 rainbow strongly favors aggressor (high positive score)', () => {
    const board: Card[] = [
      makeCard(14, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const score = rangeAdvantageScore(board, true);
    expect(score).toBeGreaterThan(0.3);
  });

  it('7-8-9 two-tone strongly favors caller (negative score)', () => {
    const board: Card[] = [
      makeCard(7, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(9, 'spades'),
    ];
    const score = rangeAdvantageScore(board, true);
    expect(score).toBeLessThan(0);
  });

  it('A-K-2 rainbow when not aggressor returns opposite score', () => {
    const board: Card[] = [
      makeCard(14, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const scoreAggressor = rangeAdvantageScore(board, true);
    const scoreCaller = rangeAdvantageScore(board, false);
    // Caller's score is negated (board that helps aggressor hurts caller)
    expect(scoreCaller).toBeLessThan(scoreAggressor);
  });

  it('returns value in [-1, 1] range', () => {
    const boards: Card[][] = [
      [makeCard(14, 'spades'), makeCard(13, 'hearts'), makeCard(2, 'diamonds')],
      [makeCard(7, 'spades'), makeCard(8, 'hearts'), makeCard(9, 'spades')],
      [makeCard(10, 'spades'), makeCard(6, 'hearts'), makeCard(3, 'diamonds')],
    ];
    for (const board of boards) {
      const score = rangeAdvantageScore(board, true);
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('J-T-6 connected board produces lower score than A-K-2 rainbow', () => {
    const highBoard: Card[] = [
      makeCard(14, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const connectedBoard: Card[] = [
      makeCard(11, 'spades'),
      makeCard(10, 'hearts'),
      makeCard(6, 'diamonds'),
    ];
    const scoreHigh = rangeAdvantageScore(highBoard, true);
    const scoreConnected = rangeAdvantageScore(connectedBoard, true);
    expect(scoreHigh).toBeGreaterThan(scoreConnected);
  });

  it('paired board reduces advantage compared to dry rainbow', () => {
    const dryBoard: Card[] = [
      makeCard(14, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const pairedBoard: Card[] = [
      makeCard(14, 'spades'),
      makeCard(14, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const scoreDry = rangeAdvantageScore(dryBoard, true);
    const scorePaired = rangeAdvantageScore(pairedBoard, true);
    // Paired boards reduce the aggressor's edge
    expect(scoreDry).toBeGreaterThan(scorePaired);
  });

  it('Q high dry board has positive aggressor score', () => {
    const board: Card[] = [
      makeCard(12, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'diamonds'),
    ];
    const score = rangeAdvantageScore(board, true);
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================================
// multiwayPenalty
// ============================================================

describe('multiwayPenalty', () => {
  it('returns 1.0 for 1 opponent (heads-up)', () => {
    expect(multiwayPenalty(1)).toBe(1.0);
  });

  it('returns 0.65 for 2 opponents', () => {
    expect(multiwayPenalty(2)).toBeCloseTo(0.65);
  });

  it('returns 0.40 for 3 opponents', () => {
    expect(multiwayPenalty(3)).toBeCloseTo(0.40);
  });

  it('returns 0.40 for 4+ opponents (same as 3+)', () => {
    expect(multiwayPenalty(4)).toBeCloseTo(0.40);
    expect(multiwayPenalty(6)).toBeCloseTo(0.40);
  });

  it('penalty decreases as opponents increase', () => {
    expect(multiwayPenalty(1)).toBeGreaterThan(multiwayPenalty(2));
    expect(multiwayPenalty(2)).toBeGreaterThan(multiwayPenalty(3));
  });
});
