import { describe, it, expect } from 'vitest';
import {
  createStats,
  trackAction,
  incrementHandsEligible,
} from '@/engine/stats-tracker';
import type { PlayerStats } from '@/types';

// ============================================================
// Helper
// ============================================================

function freshStats(): PlayerStats {
  return createStats();
}

// ============================================================
// AC-10: VPIP tracking
// ============================================================

describe('AC-10: VPIP tracking', () => {
  it('should increment vpipCount on voluntary preflop call', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CALL',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
    });
    expect(stats.vpipCount).toBe(1);
  });

  it('should NOT increment vpipCount for blind post', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CALL',
      street: 'PREFLOP',
      isBlind: true,
      isRaise: false,
      isFacingFirstRaise: false,
    });
    expect(stats.vpipCount).toBe(0);
  });

  it('should NOT increment vpipCount for fold preflop', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'FOLD',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
    });
    expect(stats.vpipCount).toBe(0);
  });

  it('should NOT increment vpipCount for postflop actions', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CALL',
      street: 'FLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
    });
    expect(stats.vpipCount).toBe(0);
  });
});

// ============================================================
// AC-11: PFR tracking
// ============================================================

describe('AC-11: PFR tracking', () => {
  it('should increment pfrCount on preflop open raise', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'RAISE',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: true,
      isFacingFirstRaise: false,
    });
    expect(stats.pfrCount).toBe(1);
    expect(stats.vpipCount).toBe(1); // PFR also counts as VPIP
  });

  it('should increment pfrCount on preflop BET action', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'BET',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: true,
      isFacingFirstRaise: false,
    });
    expect(stats.pfrCount).toBe(1);
  });

  it('should NOT increment pfrCount for preflop CALL', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CALL',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
    });
    expect(stats.pfrCount).toBe(0);
  });
});

// ============================================================
// AC-12: C-Bet tracking
// ============================================================

describe('AC-12: C-Bet tracking', () => {
  it('should increment cBetOpportunities when aggressor first to act on flop', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CHECK',
      street: 'FLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
      isAggressor: true,
      isCBetOpportunity: true,
    });
    expect(stats.cBetOpportunities).toBe(1);
  });

  it('should increment cBetCount when aggressor bets on flop', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'BET',
      street: 'FLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
      isAggressor: true,
      isCBetOpportunity: true,
    });
    expect(stats.cBetCount).toBe(1);
    expect(stats.cBetOpportunities).toBe(1);
  });

  it('should NOT count cBet for non-aggressor', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'BET',
      street: 'FLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: false,
      isAggressor: false,
      isCBetOpportunity: false,
    });
    expect(stats.cBetCount).toBe(0);
    expect(stats.cBetOpportunities).toBe(0);
  });
});

// ============================================================
// AC-13: 3-Bet tracking
// ============================================================

describe('AC-13: 3-Bet tracking', () => {
  it('should increment threeBetCount when player re-raises preflop', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'RAISE',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: true,
      isFacingFirstRaise: true, // facing first raise = 3-bet opportunity
    });
    expect(stats.threeBetCount).toBe(1);
    expect(stats.threeBetOpportunities).toBe(1);
  });

  it('should count threeBetOpportunities when facing first raise without 3-betting', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'CALL',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: false,
      isFacingFirstRaise: true,
    });
    expect(stats.threeBetOpportunities).toBe(1);
    expect(stats.threeBetCount).toBe(0);
  });

  it('should NOT count 3-bet opportunity when not facing first raise', () => {
    const stats = freshStats();
    trackAction(stats, {
      actionType: 'RAISE',
      street: 'PREFLOP',
      isBlind: false,
      isRaise: true,
      isFacingFirstRaise: false,
    });
    expect(stats.threeBetOpportunities).toBe(0);
    expect(stats.threeBetCount).toBe(0);
  });
});

// ============================================================
// AC-14: Hands eligible counting
// ============================================================

describe('AC-14: handsEligible counting', () => {
  it('should increment handsEligible when called', () => {
    const stats = freshStats();
    expect(stats.handsEligible).toBe(0);
    incrementHandsEligible(stats);
    expect(stats.handsEligible).toBe(1);
  });

  it('should increment multiple times', () => {
    const stats = freshStats();
    incrementHandsEligible(stats);
    incrementHandsEligible(stats);
    incrementHandsEligible(stats);
    expect(stats.handsEligible).toBe(3);
  });
});

// ============================================================
// createStats: fresh initial state
// ============================================================

describe('createStats', () => {
  it('should create stats with all zeros', () => {
    const stats = createStats();
    expect(stats.handsEligible).toBe(0);
    expect(stats.vpipCount).toBe(0);
    expect(stats.pfrCount).toBe(0);
    expect(stats.threeBetOpportunities).toBe(0);
    expect(stats.threeBetCount).toBe(0);
    expect(stats.cBetOpportunities).toBe(0);
    expect(stats.cBetCount).toBe(0);
    expect(stats.wentToShowdown).toBe(0);
    expect(stats.wonAtShowdown).toBe(0);
  });
});
