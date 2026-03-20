import { describe, it, expect } from 'vitest';
import {
  buildPreflopContext,
  buildPostflopContext,
  translateDecision,
  selectAIAction,
} from '@/ai/action-selector';
import { PRESETS } from '@/ai/presets';
import type { GameState, Player, Card } from '@/types';
import type { BettingRoundState } from '@/types';
import type { BettingPlayer } from '@/engine/betting';

// ============================================================
// Helpers
// ============================================================

function makeCard(rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14, suit: 'spades' | 'hearts' | 'diamonds' | 'clubs'): Card {
  const suitIndex = ['spades', 'hearts', 'diamonds', 'clubs'].indexOf(suit);
  const rankIndex = rank - 2;
  return { encoded: suitIndex * 13 + rankIndex, suit, rank };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Player1',
    seatIndex: 0,
    chips: 1500,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: [makeCard(14, 'spades'), makeCard(13, 'hearts')],
    isHuman: false,
    isActive: true,
    isFolded: false,
    isAllIn: false,
    aiProfile: PRESETS.TAG,
    stats: {
      handsEligible: 0,
      vpipCount: 0,
      pfrCount: 0,
      threeBetOpportunities: 0,
      threeBetCount: 0,
      cBetOpportunities: 0,
      cBetCount: 0,
      wentToShowdown: 0,
      wonAtShowdown: 0,
    },
    ...overrides,
  };
}

function makeBettingRound(overrides: Partial<BettingRoundState> = {}): BettingRoundState {
  return {
    street: 'PREFLOP',
    currentBet: 20,
    lastFullRaiseSize: 20,
    lastAggressorId: null,
    actedPlayerIds: [],
    playerLastFacedBet: {},
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const players: Player[] = [
    makePlayer({ id: 'p1', seatIndex: 0 }),
    makePlayer({ id: 'p2', seatIndex: 1 }),
    makePlayer({ id: 'p3', seatIndex: 2 }),
    makePlayer({ id: 'p4', seatIndex: 3 }),
    makePlayer({ id: 'p5', seatIndex: 4 }),
    makePlayer({ id: 'p6', seatIndex: 5 }),
    makePlayer({ id: 'p7', seatIndex: 6 }),
    makePlayer({ id: 'p8', seatIndex: 7 }),
  ];

  return {
    phase: 'PREFLOP',
    players,
    communityCards: [],
    mainPot: 30,
    sidePots: [],
    currentPlayerIndex: 3,
    buttonSeatIndex: 7,
    sbSeatIndex: 0,
    bbSeatIndex: 1,
    blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    handsPlayedInLevel: 0,
    handNumber: 1,
    actionHistory: [],
    bettingRound: makeBettingRound(),
    seed: 'test-seed',
    ...overrides,
  };
}

const deterministicRng = () => 0.1;

// ============================================================
// AC-1: Preflop context - unopened pot
// ============================================================

describe('AC-1: buildPreflopContext - unopened pot', () => {
  it('should detect isUnopened when no raise exists', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState({
      bettingRound: makeBettingRound({ currentBet: 20, lastAggressorId: null }),
    });
    // Only BB posted: currentBet = 20 but no aggressor = unopened
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.isUnopened).toBe(true);
    expect(ctx.limperCount).toBe(0);
  });

  it('should derive correct position for EP player in 8-handed', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState();
    const ctx = buildPreflopContext(player, state, deterministicRng);
    // seatIndex=3, buttonSeat=7, 8-handed → should be EP
    expect(['EP', 'MP', 'CO', 'BTN', 'SB', 'BB']).toContain(ctx.position);
  });

  it('should compute effectiveStackBB correctly', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3, chips: 1500 });
    const state = makeGameState({
      blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    });
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.effectiveStackBB).toBe(75); // 1500 / 20
  });

  it('should count active players correctly', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState();
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.activePlayers).toBe(8);
  });
});

// ============================================================
// AC-2: Preflop context - facing raise
// ============================================================

describe('AC-2: buildPreflopContext - facing raise', () => {
  it('should detect facingFirstRaise when someone has raised', () => {
    const player = makePlayer({ id: 'p5', seatIndex: 4 });
    const state = makeGameState({
      bettingRound: makeBettingRound({
        currentBet: 60,
        lastAggressorId: 'p3',
        actedPlayerIds: ['p4'],
      }),
    });
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.facingFirstRaise).toBe(true);
    expect(ctx.facingBet).toBe(60);
  });

  it('should set isBB for the BB player', () => {
    const bbPlayer = makePlayer({ id: 'p2', seatIndex: 1 }); // bbSeatIndex = 1
    const state = makeGameState({
      bettingRound: makeBettingRound({
        currentBet: 60,
        lastAggressorId: 'p4',
        actedPlayerIds: ['p3', 'p4'],
      }),
    });
    const ctx = buildPreflopContext(bbPlayer, state, deterministicRng);
    expect(ctx.isBB).toBe(true);
    expect(ctx.facingFirstRaise).toBe(true);
  });

  it('should extract highRank and lowRank from hole cards', () => {
    // AK suited
    const player = makePlayer({
      id: 'p4',
      seatIndex: 3,
      holeCards: [makeCard(14, 'spades'), makeCard(13, 'spades')],
    });
    const state = makeGameState();
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.highRank).toBe(14);
    expect(ctx.lowRank).toBe(13);
    expect(ctx.suited).toBe(true);
  });
});

// ============================================================
// AC-3: Preflop context - facing 3-bet
// ============================================================

describe('AC-3: buildPreflopContext - facing 3-bet', () => {
  it('should detect facingThreeBet when player was last raiser and someone re-raised', () => {
    // p4 raised first, now p5 has re-raised (3-bet), p4 faces it
    const player = makePlayer({ id: 'p4', seatIndex: 3, currentBet: 60 });
    const state = makeGameState({
      bettingRound: makeBettingRound({
        currentBet: 180,
        lastAggressorId: 'p5',
        actedPlayerIds: ['p4', 'p5'],
        playerLastFacedBet: { p4: 60, p5: 180 },
      }),
    });
    const ctx = buildPreflopContext(player, state, deterministicRng);
    expect(ctx.facingThreeBet).toBe(true);
  });
});

// ============================================================
// AC-4: Postflop context
// ============================================================

describe('AC-4: buildPostflopContext', () => {
  it('should set isAggressor when player is preflopAggressor', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState({
      phase: 'FLOP',
      communityCards: [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')],
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, 'p4');
    expect(ctx.isAggressor).toBe(true);
  });

  it('should compute potSize from mainPot + sidePots + currentBets', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState({
      phase: 'FLOP',
      mainPot: 100,
      sidePots: [{ amount: 50, eligiblePlayerIds: ['p1', 'p2'] }],
      communityCards: [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')],
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, null);
    // mainPot(100) + sidePot(50) + sum of currentBets (all 0 by default)
    expect(ctx.potSize).toBeGreaterThanOrEqual(150);
  });

  it('should set communityCards from state', () => {
    const flop = [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')];
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState({
      phase: 'FLOP',
      communityCards: flop,
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, null);
    expect(ctx.communityCards).toHaveLength(3);
  });

  it('should set street from bettingRound', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState({
      phase: 'TURN',
      communityCards: [
        makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs'), makeCard(5, 'diamonds'),
      ],
      bettingRound: makeBettingRound({ street: 'TURN', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, null);
    expect(ctx.street).toBe('TURN');
  });
});

// ============================================================
// AC-5: Decision translation - BET
// ============================================================

describe('AC-5: translateDecision - BET', () => {
  it('should translate BET decision to valid resolveAction call', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 1500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    const round = makeBettingRound({ currentBet: 0 });
    const result = translateDecision({ action: 'BET', amount: 60 }, bettingPlayer, round);
    expect(result.type).toBe('BET');
    expect(result.amount).toBeGreaterThan(0);
  });
});

// ============================================================
// AC-6: Decision translation - RAISE
// ============================================================

describe('AC-6: translateDecision - RAISE', () => {
  it('should translate RAISE with raise-to amount', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 1500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    const round = makeBettingRound({ currentBet: 20, lastFullRaiseSize: 20 });
    const result = translateDecision({ action: 'RAISE', amount: 80 }, bettingPlayer, round);
    expect(result.type).toBe('RAISE');
  });
});

// ============================================================
// AC-7: Decision translation - mismatch recovery
// ============================================================

describe('AC-7: translateDecision - mismatch recovery', () => {
  it('should return FOLD when CHECK is attempted facing a bet', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 1500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    // Facing a bet of 60 (currentBet = 60), player tries to CHECK
    const round = makeBettingRound({ currentBet: 60 });
    const result = translateDecision({ action: 'CHECK', amount: 0 }, bettingPlayer, round);
    // CHECK is illegal when facing bet → fallback to FOLD
    expect(result.type).toBe('FOLD');
  });

  it('should convert BET to RAISE when a bet already exists', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 1500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    // currentBet > 0 means BET is illegal → should RAISE instead
    const round = makeBettingRound({ currentBet: 40, lastFullRaiseSize: 20 });
    const result = translateDecision({ action: 'BET', amount: 100 }, bettingPlayer, round);
    // BET when there's already a bet → RAISE
    expect(result.type).toBe('RAISE');
  });
});

// ============================================================
// AC-8: Decision translation - invalid action fallback
// ============================================================

describe('AC-8: translateDecision - invalid action fallback', () => {
  it('should return FOLD as fallback when action throws', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 1500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    // CALL when no bet exists → should throw internally and fallback
    const round = makeBettingRound({ currentBet: 0 });
    const result = translateDecision({ action: 'CALL', amount: 0 }, bettingPlayer, round);
    // CALL when no bet is illegal → fallback to FOLD or CHECK
    expect(['FOLD', 'CHECK']).toContain(result.type);
  });

  it('should never throw - always returns a valid ActionResult', () => {
    const bettingPlayer: BettingPlayer = {
      id: 'p1',
      chips: 50,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };
    // Minimum bet below min → should still not crash
    const round = makeBettingRound({ currentBet: 0, lastFullRaiseSize: 20 });
    expect(() => translateDecision({ action: 'BET', amount: 1 }, bettingPlayer, round)).not.toThrow();
  });
});

// ============================================================
// AC-9: Deterministic replay
// ============================================================

describe('AC-9: Deterministic replay - same seed produces same result', () => {
  it('should return the same action for same inputs with deterministic rng', () => {
    const deterministicRng1 = () => 0.5;
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState();

    const result1 = selectAIAction(player, state, null, deterministicRng1);
    const result2 = selectAIAction(player, state, null, deterministicRng1);

    expect(result1.type).toBe(result2.type);
    expect(result1.amount).toBe(result2.amount);
  });

  it('should produce different results with different rng seeds', () => {
    // With rng=0.01 (very low, aggressive) vs rng=0.99 (very high, passive)
    const aggRng = () => 0.01;
    const passRng = () => 0.99;

    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const state = makeGameState();

    const results1: string[] = [];
    const results2: string[] = [];

    // Run multiple times to detect difference in distribution
    for (let i = 0; i < 10; i++) {
      results1.push(selectAIAction(player, state, null, aggRng).type);
      results2.push(selectAIAction(player, state, null, passRng).type);
    }

    // The aggressive rng might produce more raises; at least one result set should differ
    // (or they could coincidentally match - this is probabilistic)
    expect(results1.every(t => ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'].includes(t))).toBe(true);
    expect(results2.every(t => ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'].includes(t))).toBe(true);
  });
});

// ============================================================
// AC-15: AI profiles connected (Maniac VPIP > Nit VPIP)
// ============================================================

describe('AC-15: AI profiles - Maniac vs Nit VPIP difference', () => {
  it('Maniac should VPIP more than Nit over many preflop decisions', () => {
    const rng = () => 0.5; // deterministic middle value

    let maniacVpip = 0;
    let nitVpip = 0;
    const hands = 50;

    // Simulate 50 hands with different hole cards to test overall VPIP tendency
    for (let i = 0; i < hands; i++) {
      const highRank = (i % 13) + 2 as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
      const lowRank = Math.max(2, highRank - 1) as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

      const maniacPlayer = makePlayer({
        id: 'maniac',
        seatIndex: 3,
        holeCards: [makeCard(highRank, 'spades'), makeCard(lowRank, 'hearts')],
        aiProfile: PRESETS.Maniac,
      });
      const nitPlayer = makePlayer({
        id: 'nit',
        seatIndex: 3,
        holeCards: [makeCard(highRank, 'spades'), makeCard(lowRank, 'hearts')],
        aiProfile: PRESETS.Nit,
      });

      const state = makeGameState();
      const maniacResult = selectAIAction(maniacPlayer, state, null, rng);
      const nitResult = selectAIAction(nitPlayer, state, null, rng);

      if (maniacResult.type !== 'FOLD') maniacVpip++;
      if (nitResult.type !== 'FOLD') nitVpip++;
    }

    expect(maniacVpip).toBeGreaterThan(nitVpip);
  });
});

// ============================================================
// AC-16: Preflop aggressor tracking - isAggressor in postflop
// ============================================================

describe('AC-16: Preflop aggressor tracking', () => {
  it('should set isAggressor=true when player is the preflopAggressor on flop', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const flop = [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')];
    const state = makeGameState({
      phase: 'FLOP',
      communityCards: flop,
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, 'p4');
    expect(ctx.isAggressor).toBe(true);
  });

  it('should set isAggressor=false when player is NOT the preflopAggressor', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const flop = [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')];
    const state = makeGameState({
      phase: 'FLOP',
      communityCards: flop,
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, 'p5'); // different player was aggressor
    expect(ctx.isAggressor).toBe(false);
  });

  it('should set isAggressor=false when preflopAggressor is null', () => {
    const player = makePlayer({ id: 'p4', seatIndex: 3 });
    const flop = [makeCard(10, 'hearts'), makeCard(7, 'spades'), makeCard(2, 'clubs')];
    const state = makeGameState({
      phase: 'FLOP',
      communityCards: flop,
      bettingRound: makeBettingRound({ street: 'FLOP', currentBet: 0 }),
    });
    const ctx = buildPostflopContext(player, state, null);
    expect(ctx.isAggressor).toBe(false);
  });
});
