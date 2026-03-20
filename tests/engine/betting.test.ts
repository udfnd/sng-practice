import { describe, it, expect } from 'vitest';
import {
  createBettingRound,
  createPreflopBettingRound,
  resolveAction,
  applyAction,
  isBettingComplete,
  isAllInRunout,
  hasReopen,
  getHUActionOrder,
  type BettingPlayer,
} from '@/engine/betting';
function player(id: string, chips: number, currentBet = 0): BettingPlayer {
  return { id, chips, currentBet, isFolded: false, isAllIn: false };
}

// ========== Action Resolution ==========

describe('resolveAction', () => {
  describe('FOLD', () => {
    it('should always allow fold', () => {
      const state = createPreflopBettingRound(100);
      const result = resolveAction(player('A', 1000), 'FOLD', 0, state);
      expect(result).toEqual({ type: 'FOLD', amount: 0, raiseIncrement: 0, isAllIn: false });
    });
  });

  describe('CHECK', () => {
    it('should allow check when no bet to face', () => {
      const state = createBettingRound('FLOP', 100);
      const p = player('A', 1000);
      const result = resolveAction(p, 'CHECK', 0, state);
      expect(result.type).toBe('CHECK');
    });

    it('should reject check when facing a bet', () => {
      const state = createPreflopBettingRound(100);
      // Player has 0 currentBet, facing 100
      expect(() => resolveAction(player('A', 1000), 'CHECK', 0, state)).toThrow('Cannot check');
    });
  });

  describe('CALL', () => {
    it('should call the correct amount', () => {
      const state = createPreflopBettingRound(100);
      const result = resolveAction(player('A', 1000, 50), 'CALL', 0, state);
      expect(result.amount).toBe(50); // 100 - 50 already bet
      expect(result.isAllIn).toBe(false);
    });

    it('should call all-in when short-stacked', () => {
      const state = createPreflopBettingRound(100);
      const result = resolveAction(player('A', 30, 50), 'CALL', 0, state);
      expect(result.amount).toBe(30); // can only put in 30 more
      expect(result.isAllIn).toBe(true);
    });

    it('should reject call when no bet exists', () => {
      const state = createBettingRound('FLOP', 100);
      expect(() => resolveAction(player('A', 1000), 'CALL', 0, state)).toThrow('Cannot call');
    });
  });

  describe('BET', () => {
    it('should accept a valid first bet', () => {
      const state = createBettingRound('FLOP', 100);
      const result = resolveAction(player('A', 1000), 'BET', 200, state);
      expect(result.type).toBe('BET');
      expect(result.amount).toBe(200);
      expect(result.raiseIncrement).toBe(200);
    });

    it('should reject bet below minimum', () => {
      const state = createBettingRound('FLOP', 100);
      expect(() => resolveAction(player('A', 1000), 'BET', 50, state)).toThrow('below minimum');
    });

    it('should allow all-in bet below minimum', () => {
      const state = createBettingRound('FLOP', 100);
      const result = resolveAction(player('A', 50), 'BET', 50, state);
      expect(result.isAllIn).toBe(true);
      expect(result.amount).toBe(50);
    });

    it('should reject bet when a bet already exists', () => {
      const state = createBettingRound('FLOP', 100);
      state.currentBet = 200;
      expect(() => resolveAction(player('A', 1000), 'BET', 300, state)).toThrow('Use RAISE');
    });
  });

  describe('RAISE', () => {
    it('should accept a valid raise', () => {
      const state = createPreflopBettingRound(100);
      // min raise to = 100 + 100 = 200
      const result = resolveAction(player('A', 1000), 'RAISE', 200, state);
      expect(result.type).toBe('RAISE');
      expect(result.amount).toBe(200); // raise to 200, currently bet 0
      expect(result.raiseIncrement).toBe(100); // 200 - 100 = 100
    });

    it('should reject raise below minimum', () => {
      const state = createPreflopBettingRound(100);
      expect(() => resolveAction(player('A', 1000), 'RAISE', 150, state)).toThrow('below minimum');
    });

    it('should allow all-in raise below minimum (short all-in)', () => {
      const state = createPreflopBettingRound(100);
      // Player has only 120 chips, raise to 120 (short of min 200)
      const result = resolveAction(player('A', 120), 'RAISE', 200, state);
      expect(result.isAllIn).toBe(true);
      expect(result.amount).toBe(120); // all chips
    });

    it('should reject raise when no bet exists', () => {
      const state = createBettingRound('FLOP', 100);
      expect(() => resolveAction(player('A', 1000), 'RAISE', 200, state)).toThrow('Use BET');
    });

    it('should track correct raise increment', () => {
      const state = createPreflopBettingRound(100);
      state.currentBet = 300; // someone raised to 300 (increment = 200)
      state.lastFullRaiseSize = 200;
      // min re-raise to = 300 + 200 = 500
      const result = resolveAction(player('A', 1000), 'RAISE', 600, state);
      expect(result.raiseIncrement).toBe(300); // 600 - 300
    });
  });
});

// ========== Cumulative Re-open ==========

describe('Cumulative Short All-in Re-open', () => {
  it('should detect re-open from design doc example', () => {
    // BB=100. A raises to 300 (increment=200). B all-in 380. C all-in 520.
    // A faces 520-300=220 >= 200 (lastFullRaiseSize) → re-open
    const state = createPreflopBettingRound(100);
    state.currentBet = 300;
    state.lastFullRaiseSize = 200;
    state.playerLastFacedBet['A'] = 300; // A raised to 300

    // B all-in 380 (short, increment 80 < 200)
    state.currentBet = 380;
    // C all-in 520 (short, increment 140 < 200, but cumulative 220 >= 200)
    state.currentBet = 520;

    expect(hasReopen('A', state)).toBe(true);
    // A faces 520 - 300 = 220 >= 200
  });

  it('should not re-open when cumulative increase is below threshold', () => {
    const state = createPreflopBettingRound(100);
    state.currentBet = 300;
    state.lastFullRaiseSize = 200;
    state.playerLastFacedBet['A'] = 300;

    // Only one short all-in to 380 (increase = 80 < 200)
    state.currentBet = 380;

    expect(hasReopen('A', state)).toBe(false);
  });
});

// ========== Apply Action ==========

describe('applyAction', () => {
  it('should update player state on fold', () => {
    const p = player('A', 1000);
    const state = createPreflopBettingRound(100);
    const result = resolveAction(p, 'FOLD', 0, state);
    applyAction(p, result, state);

    expect(p.isFolded).toBe(true);
    expect(state.actedPlayerIds).toContain('A');
  });

  it('should deduct chips and update bet on call', () => {
    const p = player('A', 1000, 50);
    const state = createPreflopBettingRound(100);
    const result = resolveAction(p, 'CALL', 0, state);
    applyAction(p, result, state);

    expect(p.chips).toBe(950);
    expect(p.currentBet).toBe(100);
  });

  it('should update currentBet and lastFullRaiseSize on raise', () => {
    const p = player('A', 1000);
    const state = createPreflopBettingRound(100);
    const result = resolveAction(p, 'RAISE', 300, state);
    applyAction(p, result, state);

    expect(p.chips).toBe(700);
    expect(p.currentBet).toBe(300);
    expect(state.currentBet).toBe(300);
    expect(state.lastFullRaiseSize).toBe(200); // 300 - 100 = 200
    expect(state.lastAggressorId).toBe('A');
  });

  it('raise should clear acted list (re-open for others)', () => {
    const state = createPreflopBettingRound(100);
    state.actedPlayerIds = ['B', 'C'];

    const p = player('A', 1000);
    const result = resolveAction(p, 'RAISE', 300, state);
    applyAction(p, result, state);

    // Only A should be in acted list (others need to act again)
    expect(state.actedPlayerIds).toEqual(['A']);
  });
});

// ========== Betting Round Completion ==========

describe('isBettingComplete', () => {
  it('should be complete when all players have acted with equal bets', () => {
    const players = [
      { ...player('A', 700, 300), isFolded: false, isAllIn: false },
      { ...player('B', 700, 300), isFolded: false, isAllIn: false },
    ];
    const state = createPreflopBettingRound(100);
    state.currentBet = 300;
    state.actedPlayerIds = ['A', 'B'];

    expect(isBettingComplete(players, state)).toBe(true);
  });

  it('should not be complete when a player has not acted', () => {
    const players = [
      { ...player('A', 700, 300), isFolded: false, isAllIn: false },
      { ...player('B', 1000, 0), isFolded: false, isAllIn: false },
    ];
    const state = createPreflopBettingRound(100);
    state.currentBet = 300;
    state.actedPlayerIds = ['A'];

    expect(isBettingComplete(players, state)).toBe(false);
  });

  it('should be complete when all but one folded', () => {
    const players = [
      { ...player('A', 1000, 300), isFolded: false, isAllIn: false },
      { ...player('B', 1000, 0), isFolded: true, isAllIn: false },
      { ...player('C', 1000, 0), isFolded: true, isAllIn: false },
    ];
    const state = createPreflopBettingRound(100);
    state.currentBet = 300;
    state.actedPlayerIds = ['A'];

    expect(isBettingComplete(players, state)).toBe(true);
  });
});

// ========== All-In Runout ==========

describe('isAllInRunout', () => {
  it('should detect when all players are all-in', () => {
    const players = [
      { ...player('A', 0, 500), isAllIn: true, isFolded: false },
      { ...player('B', 0, 500), isAllIn: true, isFolded: false },
    ];
    expect(isAllInRunout(players)).toBe(true);
  });

  it('should detect when one active + rest all-in/folded', () => {
    const players = [
      { ...player('A', 500, 500), isAllIn: false, isFolded: false },
      { ...player('B', 0, 500), isAllIn: true, isFolded: false },
      { ...player('C', 0, 0), isAllIn: false, isFolded: true },
    ];
    expect(isAllInRunout(players)).toBe(true);
  });

  it('should not trigger when two active players remain', () => {
    const players = [
      { ...player('A', 500, 200), isAllIn: false, isFolded: false },
      { ...player('B', 500, 200), isAllIn: false, isFolded: false },
    ];
    expect(isAllInRunout(players)).toBe(false);
  });
});

// ========== HU Action Order ==========

describe('getHUActionOrder', () => {
  it('preflop: SB acts first', () => {
    expect(getHUActionOrder('SB', 'BB', 'PREFLOP')).toEqual(['SB', 'BB']);
  });

  it('postflop: BB acts first', () => {
    expect(getHUActionOrder('SB', 'BB', 'FLOP')).toEqual(['BB', 'SB']);
    expect(getHUActionOrder('SB', 'BB', 'TURN')).toEqual(['BB', 'SB']);
    expect(getHUActionOrder('SB', 'BB', 'RIVER')).toEqual(['BB', 'SB']);
  });
});

// ========== Min-Raise Tracking ==========

describe('Min-Raise Tracking', () => {
  it('should enforce min-raise after a raise', () => {
    const state = createPreflopBettingRound(100);
    // A raises to 300 (increment = 200)
    const pA = player('A', 1000);
    const rA = resolveAction(pA, 'RAISE', 300, state);
    applyAction(pA, rA, state);

    expect(state.lastFullRaiseSize).toBe(200);

    // B must raise to at least 300 + 200 = 500
    expect(() => resolveAction(player('B', 1000), 'RAISE', 400, state)).toThrow('below minimum');

    // B can raise to 500
    const rB = resolveAction(player('B', 1000), 'RAISE', 500, state);
    expect(rB.amount).toBe(500);
  });

  it('should not update lastFullRaiseSize on short all-in', () => {
    const state = createPreflopBettingRound(100);
    // A raises to 300 (increment = 200)
    const pA = player('A', 1000);
    applyAction(pA, resolveAction(pA, 'RAISE', 300, state), state);
    expect(state.lastFullRaiseSize).toBe(200);

    // B all-in for 380 (increment = 80, short)
    const pB = player('B', 380);
    const rB = resolveAction(pB, 'RAISE', 500, state); // will go all-in for 380
    applyAction(pB, rB, state);

    // lastFullRaiseSize should stay at 200 (80 < 200, not a full raise)
    expect(state.lastFullRaiseSize).toBe(200);
  });
});

// ========== Integration: Full Preflop Round ==========

describe('Full Preflop Round', () => {
  it('should complete a standard preflop round: open, call, check', () => {
    const state = createPreflopBettingRound(100);
    const sb = player('SB', 950, 50);
    const bb = player('BB', 900, 100);
    const co = player('CO', 1000, 0);

    // CO raises to 250
    const r1 = resolveAction(co, 'RAISE', 250, state);
    applyAction(co, r1, state);
    expect(state.currentBet).toBe(250);

    // SB calls 250 (needs 200 more)
    const r2 = resolveAction(sb, 'CALL', 0, state);
    applyAction(sb, r2, state);
    expect(sb.currentBet).toBe(250);
    expect(sb.chips).toBe(750);

    // BB calls 250 (needs 150 more)
    const r3 = resolveAction(bb, 'CALL', 0, state);
    applyAction(bb, r3, state);
    expect(bb.currentBet).toBe(250);

    expect(isBettingComplete([co, sb, bb], state)).toBe(true);
  });
});
