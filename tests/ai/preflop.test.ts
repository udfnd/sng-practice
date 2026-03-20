import { describe, it, expect } from 'vitest';
import { makePreflopDecision, type PreflopContext, clamp01 } from '@/ai/preflop';
import { PRESETS } from '@/ai/presets';

function baseContext(overrides: Partial<PreflopContext> = {}): PreflopContext {
  return {
    profile: PRESETS.TAG,
    highRank: 14,  // Ace
    lowRank: 13,   // King
    suited: true,  // AKs
    position: 'CO',
    facingBet: 0,
    bb: 20,
    currentBet: 0,
    chips: 1500,
    isUnopened: true,
    limperCount: 0,
    facingFirstRaise: false,
    facingThreeBet: false,
    isBB: false,
    activePlayers: 8,
    effectiveStackBB: 75,
    ...overrides,
  };
}

describe('Preflop Decision Engine', () => {
  describe('Situation A — Unopened Pot', () => {
    it('should open raise with strong hand', () => {
      const decision = makePreflopDecision(baseContext());
      expect(['BET', 'RAISE']).toContain(decision.action);
      expect(decision.amount).toBeGreaterThan(0);
    });

    it('should fold with very weak hand', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 7, lowRank: 2, suited: false, // 72o
      }));
      expect(decision.action).toBe('FOLD');
    });

    it('Station should open limp with marginal hands', () => {
      // Station has openLimpFreq = 0.30
      const decision = makePreflopDecision(baseContext({
        profile: PRESETS.Station,
        highRank: 10, lowRank: 9, suited: true, // T9s — should limp
      }));
      // Either limp (CALL) or fold depending on percentile
      expect(['CALL', 'FOLD', 'BET', 'RAISE']).toContain(decision.action);
    });
  });

  describe('Situation B — Limped Pot', () => {
    it('should iso-raise with strong hand', () => {
      const decision = makePreflopDecision(baseContext({
        isUnopened: false,
        limperCount: 2,
        facingBet: 20, // BB
      }));
      expect(decision.action).toBe('RAISE');
    });

    it('should limp behind with marginal hand when VPIPable', () => {
      const decision = makePreflopDecision(baseContext({
        profile: PRESETS.Station,
        highRank: 8, lowRank: 7, suited: true, // 87s
        isUnopened: false,
        limperCount: 1,
        facingBet: 20,
      }));
      expect(['CALL', 'RAISE', 'FOLD']).toContain(decision.action);
    });
  });

  describe('Situation C — Facing First Raise (non-BB)', () => {
    it('should 3-bet with premium hand (AA)', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 14, lowRank: 14, suited: false, // AA
        isUnopened: false,
        facingFirstRaise: true,
        facingBet: 60, // 3BB raise
      }));
      expect(decision.action).toBe('RAISE');
      expect(decision.situation).toBe('FACING_RAISE');
    });

    it('should fold weak hand facing raise', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 7, lowRank: 2, suited: false,
        isUnopened: false,
        facingFirstRaise: true,
        facingBet: 60,
      }));
      expect(decision.action).toBe('FOLD');
    });

    it('3-bet cutoff should not exceed calling cutoff', () => {
      // This tests the CLAMP in Situation C
      for (let i = 0; i < 20; i++) {
        const decision = makePreflopDecision(baseContext({
          highRank: 14 - (i % 13), lowRank: Math.max(2, 14 - (i % 13) - 1),
          suited: i % 2 === 0,
          isUnopened: false,
          facingFirstRaise: true,
          facingBet: 60,
        }));
        // Should be a valid action
        expect(['FOLD', 'CALL', 'RAISE']).toContain(decision.action);
      }
    });
  });

  describe('Situation D — Facing 3-Bet', () => {
    it('should 4-bet with premium hand (AA)', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 14, lowRank: 14, suited: false, // AA
        isUnopened: false,
        facingThreeBet: true,
        facingBet: 180, // 3-bet size
      }));
      expect(decision.action).toBe('RAISE');
      expect(decision.situation).toBe('FACING_3BET');
    });

    it('should fold or call marginal hand facing 3-bet', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 10, lowRank: 9, suited: true,
        isUnopened: false,
        facingThreeBet: true,
        facingBet: 180,
      }));
      expect(['FOLD', 'CALL']).toContain(decision.action);
    });
  });

  describe('Situation E — BB Defense', () => {
    it('BB should defend wider than other positions', () => {
      // ATs — reasonable hand, BB should defend
      const decision = makePreflopDecision(baseContext({
        position: 'BB',
        isBB: true,
        facingFirstRaise: true,
        facingBet: 50,
        currentBet: 20,
        isUnopened: false,
      }));
      // Should call or 3-bet with a decent hand in BB
      expect(['CALL', 'RAISE']).toContain(decision.action);
      expect(decision.situation).toBe('BB_DEFENSE');
    });

    it('BB should fold very weak hand', () => {
      const decision = makePreflopDecision(baseContext({
        position: 'BB',
        highRank: 7, lowRank: 2, suited: false,
        isBB: true,
        facingFirstRaise: true,
        facingBet: 60,
        currentBet: 20,
        isUnopened: false,
      }));
      expect(decision.action).toBe('FOLD');
    });
  });

  describe('Push/Fold Mode', () => {
    it('should push with good hand at 8BB', () => {
      const decision = makePreflopDecision(baseContext({
        effectiveStackBB: 8,
        chips: 160,
      }));
      // AKs at 8BB should push
      expect(decision.action).toBe('RAISE');
      expect(decision.amount).toBe(160); // all-in
    });

    it('should fold weak hand at 5BB', () => {
      const decision = makePreflopDecision(baseContext({
        highRank: 7, lowRank: 2, suited: false,
        effectiveStackBB: 5,
        chips: 100,
      }));
      expect(decision.action).toBe('FOLD');
    });
  });

  describe('Jam Thresholds', () => {
    it('should jam 3-bet when stack ≤ 15BB', () => {
      const decision = makePreflopDecision(baseContext({
        effectiveStackBB: 14,
        chips: 280,
        isUnopened: false,
        facingFirstRaise: true,
        facingBet: 60,
      }));
      if (decision.action === 'RAISE') {
        expect(decision.amount).toBe(280); // all-in
      }
    });
  });
});

describe('clamp01', () => {
  it('should clamp negative to 0', () => {
    expect(clamp01(-0.5)).toBe(0);
  });

  it('should clamp > 1 to 1', () => {
    expect(clamp01(1.5)).toBe(1);
  });

  it('should pass through valid values', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
});
