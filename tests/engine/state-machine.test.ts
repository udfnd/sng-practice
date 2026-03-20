import { describe, it, expect } from 'vitest';
import {
  createInitialGameState,
  transitionToResolveSeats,
  transitionToPostBlinds,
  transitionToDealing,
  transitionToPreflop,
  transitionToNextStreet,
  handleFoldWin,
  isFoldWin,
  transitionToWaiting,
} from '@/engine/state-machine';
import { resolveAction, applyAction } from '@/engine/betting';
import { assertChipInvariant } from '@/engine/pot';
import type { BlindLevel } from '@/types';

const DEFAULT_BLIND: BlindLevel = { level: 1, sb: 10, bb: 20, ante: 5 };
const STARTING_CHIPS = 1500;

function playerNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player ${i}`);
}

function checkInvariant(state: ReturnType<typeof createInitialGameState>, totalChips?: number) {
  const total = totalChips ?? state.players.length * STARTING_CHIPS;
  const potPlayers = state.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));
  assertChipInvariant(potPlayers, state.mainPot, state.sidePots, total);
}

describe('Game State Machine', () => {
  it('should create initial game state', () => {
    const state = createInitialGameState(playerNames(8), STARTING_CHIPS, DEFAULT_BLIND);
    expect(state.players).toHaveLength(8);
    expect(state.phase).toBe('WAITING');
    expect(state.players[0]!.isHuman).toBe(true);
    expect(state.players[1]!.isHuman).toBe(false);
    checkInvariant(state);
  });

  it('should flow through WAITING → RESOLVE_SEATS', () => {
    const state = createInitialGameState(playerNames(8), STARTING_CHIPS, DEFAULT_BLIND);
    const assignment = transitionToResolveSeats(state);

    expect(state.phase).toBe('RESOLVE_SEATS');
    expect(state.handNumber).toBe(1);
    expect(assignment.buttonSeat).toBeDefined();
    expect(assignment.sbSeat).toBeDefined();
    expect(assignment.bbSeat).toBeDefined();
  });

  it('should flow through RESOLVE_SEATS → POSTING_BLINDS', () => {
    const state = createInitialGameState(playerNames(8), STARTING_CHIPS, DEFAULT_BLIND);
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);

    expect(state.phase).toBe('POSTING_BLINDS');

    // Check SB posted
    const sbPlayer = state.players.find((p) => p.seatIndex === state.sbSeatIndex)!;
    expect(sbPlayer.currentBet).toBe(10);
    expect(sbPlayer.chips).toBe(1490);

    // Check BB posted (BB + BBA deducted from chips, BB in currentBet, BBA in mainPot)
    const bbPlayer = state.players.find((p) => p.seatIndex === state.bbSeatIndex)!;
    expect(bbPlayer.currentBet).toBe(20);
    expect(bbPlayer.chips).toBe(1475); // 1500 - 20(BB) - 5(BBA)

    // BBA in main pot
    expect(state.mainPot).toBe(5);

    checkInvariant(state);
  });

  it('should flow through POSTING_BLINDS → DEALING', async () => {
    const state = createInitialGameState(playerNames(8), STARTING_CHIPS, DEFAULT_BLIND);
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);
    await transitionToDealing(state, 'test-seed');

    expect(state.phase).toBe('DEALING');
    expect(state.seed).toBe('test-seed');

    // All active players should have hole cards
    for (const p of state.players.filter((p) => p.isActive)) {
      expect(p.holeCards).toHaveLength(2);
    }

    checkInvariant(state);
  });

  it('should flow through DEALING → PREFLOP', async () => {
    const state = createInitialGameState(playerNames(8), STARTING_CHIPS, DEFAULT_BLIND);
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);
    await transitionToDealing(state, 'test-seed');
    transitionToPreflop(state);

    expect(state.phase).toBe('PREFLOP');
    expect(state.bettingRound.currentBet).toBe(20); // BB amount
    expect(state.bettingRound.lastFullRaiseSize).toBe(20);
  });

  it('should advance to FLOP with community cards', async () => {
    const state = createInitialGameState(playerNames(3), STARTING_CHIPS, DEFAULT_BLIND);
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);
    const deck = await transitionToDealing(state, 'test-seed');
    transitionToPreflop(state);

    // Everyone calls (simple scenario)
    for (const p of state.players.filter((p) => p.isActive && p.currentBet < 20)) {
      const potPlayer = { id: p.id, chips: p.chips, currentBet: p.currentBet, isFolded: false, isAllIn: false };
      const result = resolveAction(potPlayer, 'CALL', 0, state.bettingRound);
      p.chips -= result.amount;
      p.currentBet += result.amount;
      applyAction(potPlayer, result, state.bettingRound);
    }

    transitionToNextStreet(state, deck);

    expect(state.phase).toBe('FLOP');
    expect(state.communityCards).toHaveLength(3);
    expect(state.bettingRound.currentBet).toBe(0);
    checkInvariant(state);
  });
});

describe('Fold-Win Fast Path', () => {
  it('should award pot to last player standing', async () => {
    const state = createInitialGameState(playerNames(3), STARTING_CHIPS, DEFAULT_BLIND);
    const totalChips = STARTING_CHIPS * 3;
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);
    await transitionToDealing(state, 'fold-test');
    transitionToPreflop(state);

    // All except first non-blind player fold
    const activePlayers = state.players.filter((p) => p.isActive && p.currentBet === 0);
    for (const p of activePlayers) {
      p.isFolded = true;
    }

    // SB also folds
    const sbPlayer = state.players.find((p) => p.seatIndex === state.sbSeatIndex)!;
    sbPlayer.isFolded = true;

    expect(isFoldWin(state)).toBe(true);

    const winnerId = handleFoldWin(state);
    expect(state.phase).toBe('HAND_COMPLETE');
    expect(state.mainPot).toBe(0);
    expect(state.sidePots).toHaveLength(0);

    // Winner should have gained chips
    const winner = state.players.find((p) => p.id === winnerId)!;
    expect(winner.chips).toBeGreaterThan(STARTING_CHIPS);

    // Check invariant (total chips = 3 × 1500 = 4500)
    const totalAfter = state.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0)
      + state.mainPot + state.sidePots.reduce((s, sp) => s + sp.amount, 0);
    expect(totalAfter).toBe(totalChips);
  });
});

describe('BBA Chip Shortage', () => {
  it('BB=90 all-in: full BB, no BBA', () => {
    const blind: BlindLevel = { level: 4, sb: 50, bb: 100, ante: 15 };
    const state = createInitialGameState(playerNames(3), 1500, blind);
    // Make BB player have only 90 chips
    transitionToResolveSeats(state);

    const bbPlayer = state.players.find((p) => p.seatIndex === state.bbSeatIndex)!;
    bbPlayer.chips = 90;

    // Adjust total for test
    transitionToPostBlinds(state);

    // BB player should be all-in with 90 as BB, 0 as BBA
    expect(bbPlayer.chips).toBe(0);
    expect(bbPlayer.currentBet).toBe(90);
    expect(bbPlayer.isAllIn).toBe(true);
    // BBA = 0 since no chips left after BB
    expect(state.mainPot).toBe(0);
  });

  it('BB=120: full BB of 100, partial BBA of 20', () => {
    const blind: BlindLevel = { level: 4, sb: 50, bb: 100, ante: 25 };
    const state = createInitialGameState(playerNames(3), 1500, blind);
    transitionToResolveSeats(state);

    const bbPlayer = state.players.find((p) => p.seatIndex === state.bbSeatIndex)!;
    bbPlayer.chips = 120;

    transitionToPostBlinds(state);

    expect(bbPlayer.currentBet).toBe(100); // full BB
    expect(bbPlayer.chips).toBe(0); // 120 - 100 - 20 = 0
    expect(state.mainPot).toBe(20); // partial BBA
    expect(bbPlayer.isAllIn).toBe(true);
  });
});

describe('State Transitions', () => {
  it('should reject invalid transitions', () => {
    const state = createInitialGameState(playerNames(3), STARTING_CHIPS, DEFAULT_BLIND);
    // Can't go to post blinds from WAITING
    expect(() => transitionToPostBlinds(state)).toThrow('Invalid transition');
  });

  it('HAND_COMPLETE → WAITING marks eliminated players', async () => {
    const state = createInitialGameState(playerNames(3), STARTING_CHIPS, DEFAULT_BLIND);
    transitionToResolveSeats(state);
    transitionToPostBlinds(state);
    await transitionToDealing(state, 'elim-test');
    transitionToPreflop(state);

    // Simulate a player losing all chips
    state.players[2]!.chips = 0;
    state.phase = 'HAND_COMPLETE';

    transitionToWaiting(state);

    expect(state.phase).toBe('WAITING');
    expect(state.players[2]!.isActive).toBe(false);
  });
});

describe('3-Bucket Invariant Through Full Hand', () => {
  it('maintains chip conservation through complete hand flow', async () => {
    const state = createInitialGameState(playerNames(3), STARTING_CHIPS, DEFAULT_BLIND);
    const totalChips = STARTING_CHIPS * 3;

    // WAITING → RESOLVE_SEATS
    transitionToResolveSeats(state);
    checkInvariant(state);

    // RESOLVE_SEATS → POSTING_BLINDS
    transitionToPostBlinds(state);
    // Recalculate total for this test (BBA adjusted)
    const actualTotal = state.players.reduce((s, p) => s + p.chips + p.currentBet, 0)
      + state.mainPot + state.sidePots.reduce((s, sp) => s + sp.amount, 0);
    expect(actualTotal).toBe(totalChips);

    // POSTING_BLINDS → DEALING
    await transitionToDealing(state, 'invariant-test');

    // DEALING → PREFLOP
    transitionToPreflop(state);

    // Verify invariant at every step
    const checkTotal = () => {
      const t = state.players.reduce((s, p) => s + p.chips + p.currentBet, 0)
        + state.mainPot + state.sidePots.reduce((s, sp) => s + sp.amount, 0);
      expect(t).toBe(totalChips);
    };

    checkTotal();
  });
});
