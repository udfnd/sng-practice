import { describe, it, expect } from 'vitest';
import {
  assertChipInvariant,
  collectBets,
  calcUncalledBet,
  distributePot,
  addBbaToMainPot,
  type PotPlayer,
} from '@/engine/pot';

/** Helper to create a PotPlayer */
function player(
  id: string,
  chips: number,
  currentBet: number,
  opts?: { isFolded?: boolean; isAllIn?: boolean },
): PotPlayer {
  return {
    id,
    chips,
    currentBet,
    isFolded: opts?.isFolded ?? false,
    isAllIn: opts?.isAllIn ?? false,
  };
}

// ========== Chip Invariant ==========

describe('assertChipInvariant', () => {
  it('should pass when invariant holds', () => {
    const players = [player('A', 800, 200), player('B', 500, 500)];
    // 800 + 200 + 500 + 500 + 0 = 2000
    expect(() => assertChipInvariant(players, 0, [], 2000)).not.toThrow();
  });

  it('should fail when invariant is violated', () => {
    const players = [player('A', 800, 200), player('B', 500, 500)];
    expect(() => assertChipInvariant(players, 0, [], 1999)).toThrow('Chip invariant violated');
  });

  it('should include pots in calculation', () => {
    const players = [player('A', 800, 0), player('B', 500, 0)];
    expect(() =>
      assertChipInvariant(players, 500, [{ amount: 200, eligiblePlayerIds: ['A', 'B'] }], 2000),
    ).not.toThrow();
  });

  it('should catch 1-chip discrepancy', () => {
    const players = [player('A', 1000, 0), player('B', 999, 0)];
    expect(() => assertChipInvariant(players, 0, [], 2000)).toThrow();
  });
});

// ========== collectBets ==========

describe('collectBets', () => {
  it('should collect all bets to main pot when no all-ins', () => {
    const players = [player('A', 800, 200), player('B', 700, 300)];
    const result = collectBets(players, 0, []);

    expect(result.mainPot).toBe(500);
    expect(result.sidePots).toHaveLength(0);
    expect(players[0]!.currentBet).toBe(0);
    expect(players[1]!.currentBet).toBe(0);
  });

  it('should add to existing main pot', () => {
    const players = [player('A', 800, 200), player('B', 700, 200)];
    const result = collectBets(players, 100, []);

    expect(result.mainPot).toBe(500); // 100 existing + 400 new
  });

  it('should create side pot for single all-in', () => {
    // A bets 300 (has 300 more behind), B all-in for 200
    const players = [
      player('A', 500, 300),
      player('B', 0, 200, { isAllIn: true }),
    ];
    const result = collectBets(players, 0, []);

    // Main pot: 200 + 200 = 400 (both contribute up to B's all-in)
    expect(result.mainPot).toBe(400);
    // Side pot: 100 (A's excess) — only A is eligible
    expect(result.sidePots).toHaveLength(1);
    expect(result.sidePots[0]!.amount).toBe(100);
    expect(result.sidePots[0]!.eligiblePlayerIds).toEqual(['A']);
  });

  it('should create multiple side pots for multiple all-ins', () => {
    // A bets 500, B all-in 300, C all-in 100
    const players = [
      player('A', 200, 500),
      player('B', 0, 300, { isAllIn: true }),
      player('C', 0, 100, { isAllIn: true }),
    ];
    const result = collectBets(players, 0, []);

    // Main pot: 100×3 = 300 (all contribute up to C's 100)
    expect(result.mainPot).toBe(300);
    // Side pot 1: (300-100)×2 = 400 (A and B contribute, C is out)
    expect(result.sidePots).toHaveLength(2);
    expect(result.sidePots[0]!.amount).toBe(400);
    expect(result.sidePots[0]!.eligiblePlayerIds).toContain('A');
    expect(result.sidePots[0]!.eligiblePlayerIds).toContain('B');
    // Side pot 2: (500-300)×1 = 200 (only A)
    expect(result.sidePots[1]!.amount).toBe(200);
    expect(result.sidePots[1]!.eligiblePlayerIds).toEqual(['A']);
  });

  it('should handle folded players contributing to pots', () => {
    // A bets 300, B folded with 100 bet, C all-in 200
    const players = [
      player('A', 500, 300),
      player('B', 700, 100, { isFolded: true }),
      player('C', 0, 200, { isAllIn: true }),
    ];
    const result = collectBets(players, 0, []);

    // Main pot: 200+100+200 = 500 (up to C's all-in of 200, B only has 100)
    expect(result.mainPot).toBe(500);
    // Side pot: (300-200) from A only = 100
    expect(result.sidePots).toHaveLength(1);
    expect(result.sidePots[0]!.amount).toBe(100);
    // B is folded so not eligible for any pot
    expect(result.sidePots[0]!.eligiblePlayerIds).not.toContain('B');
  });

  it('should zero all player bets after collecting', () => {
    const players = [player('A', 800, 200), player('B', 700, 300), player('C', 600, 400)];
    collectBets(players, 0, []);
    for (const p of players) {
      expect(p.currentBet).toBe(0);
    }
  });

  it('should handle zero bets (no action)', () => {
    const players = [player('A', 1000, 0), player('B', 1000, 0)];
    const result = collectBets(players, 50, []);
    expect(result.mainPot).toBe(50);
    expect(result.sidePots).toHaveLength(0);
  });
});

// ========== Uncalled Bet ==========

describe('calcUncalledBet', () => {
  it('should return excess when bet is uncalled', () => {
    expect(calcUncalledBet(500, 300)).toBe(200);
  });

  it('should return 0 when bet is fully called', () => {
    expect(calcUncalledBet(300, 300)).toBe(0);
  });

  it('should return 0 when last bettor is smaller', () => {
    expect(calcUncalledBet(200, 300)).toBe(0);
  });

  it('should handle all-in vs all-in (larger returns excess)', () => {
    expect(calcUncalledBet(1000, 700)).toBe(300);
  });
});

// ========== Pot Distribution ==========

describe('distributePot', () => {
  const seatMap = new Map([['A', 0], ['B', 1], ['C', 2], ['D', 3]]);
  const seatOrder = [0, 1, 2, 3];

  it('should give entire pot to single winner', () => {
    const payouts = distributePot(1000, ['A'], seatMap, 0, seatOrder);
    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toEqual({ playerId: 'A', amount: 1000 });
  });

  it('should split pot evenly between tied winners', () => {
    const payouts = distributePot(1000, ['A', 'B'], seatMap, 0, seatOrder);
    expect(payouts).toHaveLength(2);
    expect(payouts.find((p) => p.playerId === 'A')!.amount).toBe(500);
    expect(payouts.find((p) => p.playerId === 'B')!.amount).toBe(500);
  });

  it('should give odd chip to button-clockwise nearest winner', () => {
    // Pot: 1001, 2 winners. 500 each + 1 odd chip
    // Button at seat 0, A at seat 1 is closer than B at seat 3
    const payouts = distributePot(
      1001,
      ['A', 'B'],
      new Map([['A', 1], ['B', 3]]),
      0,
      [0, 1, 2, 3],
    );
    expect(payouts.find((p) => p.playerId === 'A')!.amount).toBe(501);
    expect(payouts.find((p) => p.playerId === 'B')!.amount).toBe(500);
  });

  it('should handle 3-way split with odd chip', () => {
    // 1000 / 3 = 333 each + 1 remainder
    const payouts = distributePot(1000, ['A', 'B', 'C'], seatMap, 0, seatOrder);
    const total = payouts.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBe(1000);
    // One player gets 334, others get 333
    const amounts = payouts.map((p) => p.amount).sort();
    expect(amounts).toEqual([333, 333, 334]);
  });

  it('should throw when no winners', () => {
    expect(() => distributePot(1000, [], seatMap, 0, seatOrder)).toThrow();
  });
});

// ========== BBA Routing ==========

describe('BBA Routing', () => {
  it('should add BBA directly to main pot', () => {
    expect(addBbaToMainPot(0, 25)).toBe(25);
  });

  it('should add to existing main pot', () => {
    expect(addBbaToMainPot(100, 25)).toBe(125);
  });

  it('BBA should not affect player currentBet', () => {
    const players = [
      player('BB', 875, 100), // BB posted 100 to currentBet, BBA goes to mainPot separately
      player('SB', 950, 50),
    ];
    // BBA = 25, goes to mainPot
    const mainPot = addBbaToMainPot(0, 25);
    expect(mainPot).toBe(25);
    // BB's currentBet is still just the BB amount
    expect(players[0]!.currentBet).toBe(100);
  });
});

// ========== Integration: Invariant Through Operations ==========

describe('Invariant Through Full Hand', () => {
  it('should maintain invariant through blinds → bets → collect → award', () => {
    const totalChips = 3000;
    const players = [
      player('A', 1000, 0),
      player('B', 1000, 0),
      player('C', 1000, 0),
    ];

    // Post blinds: SB=50, BB=100
    players[0]!.chips -= 50;
    players[0]!.currentBet = 50;
    players[1]!.chips -= 100;
    players[1]!.currentBet = 100;

    // BBA = 25 from BB
    players[1]!.chips -= 25;
    let mainPot = addBbaToMainPot(0, 25);

    assertChipInvariant(players, mainPot, [], totalChips);

    // Preflop: A calls 100, B checks, C raises to 300
    players[0]!.chips -= 50; // additional 50 to match 100
    players[0]!.currentBet = 100;
    players[2]!.chips -= 300;
    players[2]!.currentBet = 300;
    // A calls 300
    players[0]!.chips -= 200;
    players[0]!.currentBet = 300;
    // B calls 300
    players[1]!.chips -= 200;
    players[1]!.currentBet = 300;

    assertChipInvariant(players, mainPot, [], totalChips);

    // Collect bets
    const result = collectBets(players, mainPot, []);
    mainPot = result.mainPot;

    assertChipInvariant(players, mainPot, result.sidePots, totalChips);
    expect(mainPot).toBe(925); // 25 BBA + 300×3 = 925
    expect(players.every((p) => p.currentBet === 0)).toBe(true);

    // Award pot to winner (A)
    players[0]!.chips += mainPot;
    mainPot = 0;

    assertChipInvariant(players, mainPot, [], totalChips);
  });
});
