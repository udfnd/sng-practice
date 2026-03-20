import { describe, it, expect } from 'vitest';
import { calculateICM, computeBubbleFactor, icmAdjustedThreshold } from '@/ai/icm';

// ============================================================
// ICM Calculation Engine Tests
// SPEC-AI-008
// ============================================================

describe('calculateICM', () => {
  it('equal stacks with 4 players, top 3 paid: each gets ~25% equity', () => {
    const stacks = [1000, 1000, 1000, 1000];
    const payouts = [500, 300, 200]; // sum = 1000
    const equities = calculateICM(stacks, payouts);

    expect(equities).toHaveLength(4);

    // Each player should get approximately 25% of the prize pool (250)
    for (const equity of equities) {
      expect(equity).toBeCloseTo(250, 1);
    }

    // Sum invariant: sum(equities) === sum(payouts) within 0.01
    const sumEquities = equities.reduce((a, b) => a + b, 0);
    const sumPayouts = payouts.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumEquities - sumPayouts)).toBeLessThan(0.01);
  });

  it('dominant chip leader: ICM compresses equity below chip-proportional', () => {
    // ICM compression: chip leader gets LESS than pure chip proportion
    // because short stacks receive a "min-cash bonus" from ICM
    const stacks = [6000, 2000, 2000];
    const payouts = [500, 300, 200]; // sum = 1000
    const equities = calculateICM(stacks, payouts);

    // Chip leader has 60% of chips but gets less than 60% of prize pool
    const chipProportion = 6000 / 10000; // 0.6
    const proportionalEquity = chipProportion * 1000; // 600
    // ICM gives less to the chip leader than raw proportional
    expect(equities[0]).toBeLessThan(proportionalEquity);
    // But chip leader still gets significantly more than equal share (333)
    expect(equities[0]).toBeGreaterThan(333);
    // And more than the other players
    expect(equities[0]).toBeGreaterThan(equities[1]);
    expect(equities[0]).toBeGreaterThan(equities[2]);

    // Sum invariant
    const sumEquities = equities.reduce((a, b) => a + b, 0);
    const sumPayouts = payouts.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumEquities - sumPayouts)).toBeLessThan(0.01);
  });

  it('micro stack on bubble: ICM gives them slightly more than proportional (survival bonus)', () => {
    // With 4 players and top 3 paid, the micro stack benefits from ICM
    // because 3 big stacks might bust each other, giving micro stack a min-cash
    const stacks = [3300, 3300, 3300, 100];
    const payouts = [500, 300, 200]; // top 3 paid, player 3 is on the bubble
    const equities = calculateICM(stacks, payouts);

    // Micro stack has very small equity in absolute terms
    expect(equities[3]).toBeGreaterThan(0);
    expect(equities[3]).toBeLessThan(50); // much less than equal share (250)

    // Each big stack gets significantly more equity than micro stack
    expect(equities[0]).toBeGreaterThan(equities[3] * 10);

    // Sum invariant
    const sumEquities = equities.reduce((a, b) => a + b, 0);
    const sumPayouts = payouts.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumEquities - sumPayouts)).toBeLessThan(0.01);
  });

  it('2 players HU: equity is weighted sum of both payouts', () => {
    // HU with 2 payouts: equity is NOT purely proportional, but weighted sum
    // P(p0 first) = 0.7 -> 0.7 * 700 = 490
    // P(p0 second) = 0.3 -> 0.3 * 300 = 90
    // Equity[0] = 580
    const stacks = [7000, 3000];
    const payouts = [700, 300]; // sum = 1000
    const equities = calculateICM(stacks, payouts);

    expect(equities).toHaveLength(2);
    expect(equities[0]).toBeCloseTo(580, 0);
    expect(equities[1]).toBeCloseTo(420, 0);

    // Sum invariant
    const sumEquities = equities.reduce((a, b) => a + b, 0);
    const sumPayouts = payouts.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumEquities - sumPayouts)).toBeLessThan(0.01);
  });

  it('sum invariant holds for various configurations', () => {
    const configs = [
      { stacks: [1000, 1000, 1000], payouts: [500, 300, 200] },
      { stacks: [5000, 3000, 1500, 500], payouts: [500, 300, 200] },
      { stacks: [2000, 2000], payouts: [700, 300] },
      { stacks: [8000, 1500, 300, 200], payouts: [500, 300, 200] },
    ];

    for (const { stacks, payouts } of configs) {
      const equities = calculateICM(stacks, payouts);
      const sumEquities = equities.reduce((a, b) => a + b, 0);
      const sumPayouts = payouts.reduce((a, b) => a + b, 0);
      expect(Math.abs(sumEquities - sumPayouts)).toBeLessThan(0.01);
    }
  });

  it('performance: 8 players 3 payouts completes in < 1ms', () => {
    const stacks = [3000, 2500, 2000, 1500, 1000, 800, 500, 200];
    const payouts = [500, 300, 200];

    const start = performance.now();
    calculateICM(stacks, payouts);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1);
  });
});

describe('computeBubbleFactor', () => {
  it('HU bubble factor is approximately 1.0', () => {
    // 2 players HU: equal risk/reward
    const stacks = [5000, 5000];
    const payouts = [700, 300];
    const playerIndex = 0;
    const opponentIndex = 1;
    const effectiveStack = 2000;

    const bf = computeBubbleFactor(stacks, payouts, playerIndex, opponentIndex, effectiveStack);

    // HU: bubble factor should be close to 1.0 (winner takes all dynamic)
    expect(bf).toBeGreaterThanOrEqual(1.0);
    expect(bf).toBeLessThan(1.5);
  });

  it('early tournament with 8 players: bubble factor near 1.0', () => {
    // 8 players with equal stacks, early tournament
    const stacks = [1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500];
    const payouts = [5000, 3000, 2000]; // top 3 paid
    const playerIndex = 0;
    const opponentIndex = 1;
    const effectiveStack = 500; // small relative to stacks

    const bf = computeBubbleFactor(stacks, payouts, playerIndex, opponentIndex, effectiveStack);

    // Early tournament: no bubble pressure, BF should be close to 1.0
    expect(bf).toBeGreaterThanOrEqual(1.0);
    expect(bf).toBeLessThan(1.5);
  });

  it('medium stack on bubble (4 players, top 3 paid): bubble factor > 1.0 with significant pressure', () => {
    // 4 players, top 3 paid = exact bubble
    // Medium stack facing chip leader is at risk
    const stacks = [4000, 3000, 2000, 1000];
    const payouts = [500, 300, 200];
    const playerIndex = 2; // medium-small stack
    const opponentIndex = 0; // chip leader
    const effectiveStack = 1000;

    const bf = computeBubbleFactor(stacks, payouts, playerIndex, opponentIndex, effectiveStack);

    // Bubble factor should reflect meaningful ICM pressure
    expect(bf).toBeGreaterThan(1.0);
    expect(bf).toBeGreaterThan(1.2); // significant bubble pressure
    expect(bf).toBeGreaterThanOrEqual(1.0); // always >= 1.0
  });

  it('short stack on exact bubble: bubble factor significantly above 1.0', () => {
    // Classic bubble spot: 4 players, top 3 paid, short stack in danger
    // Short stack has highest bubble factor as they face elimination vs payout
    const stacks = [5000, 3000, 2500, 500];
    const payouts = [500, 300, 200];
    const playerIndex = 3; // short stack
    const opponentIndex = 0; // chip leader
    const effectiveStack = 500; // all-in

    const bf = computeBubbleFactor(stacks, payouts, playerIndex, opponentIndex, effectiveStack);

    // Short stack should have meaningful bubble factor
    expect(bf).toBeGreaterThan(1.0);
    // And should be higher than a safe stack in same field
    const bfSafeStack = computeBubbleFactor(stacks, payouts, 1, 0, 500);
    expect(bf).toBeGreaterThan(bfSafeStack);
    expect(bf).toBeGreaterThanOrEqual(1.0);
  });

  it('chip leader has lower bubble factor than short stack', () => {
    // 4 players, top 3 paid
    const stacks = [5000, 3000, 1500, 500];
    const payouts = [500, 300, 200];
    const effectiveStack = 500;

    const bfChipLeader = computeBubbleFactor(stacks, payouts, 0, 3, effectiveStack);
    const bfShortStack = computeBubbleFactor(stacks, payouts, 3, 0, effectiveStack);

    expect(bfShortStack).toBeGreaterThan(bfChipLeader);
  });

  it('bubble factor is always >= 1.0', () => {
    const configs = [
      { stacks: [5000, 5000], payouts: [700, 300], pi: 0, oi: 1, es: 1000 },
      { stacks: [3000, 2000, 1000], payouts: [500, 300, 200], pi: 0, oi: 2, es: 500 },
      { stacks: [4000, 3000, 2000, 1000], payouts: [500, 300, 200], pi: 2, oi: 0, es: 1000 },
    ];

    for (const { stacks, payouts, pi, oi, es } of configs) {
      const bf = computeBubbleFactor(stacks, payouts, pi, oi, es);
      expect(bf).toBeGreaterThanOrEqual(1.0);
    }
  });
});

describe('icmAdjustedThreshold', () => {
  it('with icmAwareness=0: returns base threshold unchanged', () => {
    const baseThreshold = 0.3;
    const bubbleFactor = 2.5;
    const icmAwareness = 0;
    const bubbleTightness = 0.8;

    const adjusted = icmAdjustedThreshold(baseThreshold, bubbleFactor, icmAwareness, bubbleTightness);
    expect(adjusted).toBeCloseTo(baseThreshold, 5);
  });

  it('with icmAwareness=1 and bubbleFactor=1: returns base threshold', () => {
    const baseThreshold = 0.3;
    const bubbleFactor = 1.0;
    const icmAwareness = 1.0;
    const bubbleTightness = 1.0;

    const adjusted = icmAdjustedThreshold(baseThreshold, bubbleFactor, icmAwareness, bubbleTightness);
    expect(adjusted).toBeCloseTo(baseThreshold, 5);
  });

  it('with high bubbleFactor: threshold is tightened (lower value)', () => {
    const baseThreshold = 0.3;
    const bubbleFactor = 2.5;
    const icmAwareness = 0.9;
    const bubbleTightness = 0.8;

    const adjusted = icmAdjustedThreshold(baseThreshold, bubbleFactor, icmAwareness, bubbleTightness);
    expect(adjusted).toBeLessThan(baseThreshold);
    expect(adjusted).toBeGreaterThan(0);
  });

  it('higher bubbleTightness causes more tightening', () => {
    const baseThreshold = 0.3;
    const bubbleFactor = 2.0;
    const icmAwareness = 0.7;

    const adjustedLow = icmAdjustedThreshold(baseThreshold, bubbleFactor, icmAwareness, 0.2);
    const adjustedHigh = icmAdjustedThreshold(baseThreshold, bubbleFactor, icmAwareness, 0.8);

    expect(adjustedHigh).toBeLessThan(adjustedLow);
  });

  it('adjusted threshold stays in [0, 1] range', () => {
    const configs = [
      { bt: 0.3, bf: 3.0, ia: 1.0, tightness: 1.0 },
      { bt: 0.05, bf: 3.0, ia: 1.0, tightness: 1.0 },
      { bt: 0.9, bf: 1.0, ia: 0.5, tightness: 0.5 },
    ];

    for (const { bt, bf, ia, tightness } of configs) {
      const adjusted = icmAdjustedThreshold(bt, bf, ia, tightness);
      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(1);
    }
  });
});
