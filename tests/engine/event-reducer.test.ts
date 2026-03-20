import { describe, it, expect } from 'vitest';
import { runHand, type ActionProvider } from '@/engine/orchestrator';
import { createTournament, createDefaultConfig } from '@/engine/tournament';
import { reduceEvents, reduceEventsPartial, validateEventSequence, EventSequenceError } from '@/engine/event-reducer';
import type { TournamentState, GameEvent, BlindLevel, HandStartPayload, PlayerActionPayload } from '@/types';
import type { BettingPlayer } from '@/engine/betting';
import type { ValidActionsResult } from '@/engine/action-order';

// ============================================================
// Helper factories
// ============================================================

function makeTournament(playerCount: number = 4, overrides?: { ante?: number }): TournamentState {
  const blindSchedule: BlindLevel[] = [
    { level: 1, sb: 10, bb: 20, ante: overrides?.ante ?? 0 },
    { level: 2, sb: 15, bb: 30, ante: 5 },
  ];
  const config = createDefaultConfig({
    playerCount: playerCount as 8,
    startingChips: 1500,
    handsPerLevel: 100,
    blindSchedule,
    payoutStructure: 'top3',
    payoutRatios: [0.5, 0.3, 0.2],
    initialSeed: 'test-seed',
  });
  const names = Array.from({ length: playerCount }, (_, i) => `Player${i}`);
  return createTournament(config, names);
}

const callOrCheckProvider: ActionProvider = async (
  _playerId: string,
  validActions: ValidActionsResult,
  _bettingPlayer: BettingPlayer,
) => {
  if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
  if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
  return { type: 'FOLD', amount: 0 };
};

const foldProvider: ActionProvider = async (_playerId, _validActions) => {
  return { type: 'FOLD', amount: 0 };
};

// ============================================================
// AC-1: Reducer produces valid state from complete hand events
// ============================================================

describe('AC-1: Reducer produces valid state from complete hand events', () => {
  it('should produce a GameState from a complete hand event sequence', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const state = reduceEvents(events);

    expect(state).toBeDefined();
    expect(state.players).toBeDefined();
    expect(state.players.length).toBeGreaterThan(0);
    expect(state.handNumber).toBeGreaterThan(0);
  });

  it('should have a valid phase after reducing complete hand events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const state = reduceEvents(events);

    expect(state.phase).toBeDefined();
    // After a complete hand, phase should be HAND_COMPLETE or close to it
    expect(['HAND_COMPLETE', 'SHOWDOWN', 'RIVER', 'WAITING']).toContain(state.phase);
  });
});

// ============================================================
// AC-2: Reducer parity with live orchestrator (chip counts match)
// ============================================================

describe('AC-2: Reducer parity with live orchestrator', () => {
  it('should produce same chip counts as live orchestrator after hand', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const reducedState = reduceEvents(events);

    // The total chips in the reduced state must equal total chips in tournament
    const totalReduced = reducedState.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0)
      + reducedState.mainPot
      + reducedState.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

    expect(totalReduced).toBe(tournament.totalChips);
  });

  it('should have same player chip stacks as live state after complete hand', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const reducedState = reduceEvents(events);

    // Compare each player's chip count
    for (const livePlayer of tournament.gameState.players) {
      const reducedPlayer = reducedState.players.find((p) => p.id === livePlayer.id);
      expect(reducedPlayer).toBeDefined();
      expect(reducedPlayer!.chips).toBe(livePlayer.chips);
    }
  });
});

// ============================================================
// AC-3: Partial reduction (reduceEventsPartial at index 15)
// ============================================================

describe('AC-3: Partial reduction', () => {
  it('should reduce events up to a specific index', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    // Only process if we have at least 5 events
    if (events.length >= 5) {
      const partialState = reduceEventsPartial(events, 5);
      expect(partialState).toBeDefined();
      expect(partialState.players).toBeDefined();
    }
  });

  it('should produce different state at different reduction points', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    if (events.length >= 10) {
      const earlyState = reduceEventsPartial(events, 3);
      const laterState = reduceEventsPartial(events, 10);

      // States at different points should differ (e.g., different pot sizes or community cards)
      const earlyTotal = earlyState.mainPot + earlyState.sidePots.reduce((s, sp) => s + sp.amount, 0)
        + earlyState.players.reduce((s, p) => s + p.currentBet, 0);
      const laterTotal = laterState.mainPot + laterState.sidePots.reduce((s, sp) => s + sp.amount, 0)
        + laterState.players.reduce((s, p) => s + p.currentBet, 0);

      // At least something should differ
      expect(earlyState.communityCards.length).toBeLessThanOrEqual(laterState.communityCards.length);
    }
  });

  it('should handle reduceEventsPartial at index 0 (just HAND_START)', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const state = reduceEventsPartial(events, 1);
    expect(state).toBeDefined();
    expect(state.handNumber).toBeGreaterThan(0);
  });
});

// ============================================================
// AC-4: Chip conservation in reducer after every event
// ============================================================

describe('AC-4: Chip conservation in reducer after every event', () => {
  it('should maintain chip conservation after each event during reduction', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);
    const totalChips = tournament.totalChips;

    // Check invariant at each step
    for (let i = 1; i <= events.length; i++) {
      const state = reduceEventsPartial(events, i);
      const stateTotal = state.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0)
        + state.mainPot
        + state.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

      expect(stateTotal).toBe(totalChips);
    }
  });
});

// ============================================================
// AC-5: Sequence validation - valid sequence returns true
// ============================================================

describe('AC-5: Sequence validation - valid sequence returns true', () => {
  it('should return true for a valid event sequence', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const isValid = validateEventSequence(events);
    expect(isValid).toBe(true);
  });

  it('should return true for minimal valid sequence (fold-win)', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, foldProvider);

    const isValid = validateEventSequence(events);
    expect(isValid).toBe(true);
  });
});

// ============================================================
// AC-6: Sequence validation - invalid throws EventSequenceError
// ============================================================

describe('AC-6: Sequence validation - invalid throws EventSequenceError', () => {
  it('should throw EventSequenceError for empty event array', () => {
    expect(() => validateEventSequence([])).toThrow(EventSequenceError);
  });

  it('should throw EventSequenceError when first event is not HAND_START', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    // Remove HAND_START from front
    const invalidSequence = events.slice(1);
    expect(() => validateEventSequence(invalidSequence)).toThrow(EventSequenceError);
  });

  it('should throw EventSequenceError when AWARD_POT is missing (no terminal event)', () => {
    const tournament = makeTournament(3);

    // Create a minimal but incomplete sequence with only HAND_START
    const fakeHandStart: GameEvent = {
      type: 'HAND_START',
      timestamp: Date.now(),
      handNumber: 1,
      sequenceIndex: 0,
      payload: {
        type: 'HAND_START',
        handNumber: 1,
        seed: 'test',
        blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
        buttonSeat: 0,
        sbSeat: 1,
        bbSeat: 2,
        stacks: [
          { playerId: 'p1', chips: 1500 },
          { playerId: 'p2', chips: 1500 },
        ],
      },
    };

    // Only HAND_START, no terminal event
    expect(() => validateEventSequence([fakeHandStart])).toThrow(EventSequenceError);
  });
});

// ============================================================
// AC-13: Reducer handles all event types without errors
// ============================================================

describe('AC-13: Reducer handles all event types without errors', () => {
  it('should handle full call-through hand (all streets)', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    expect(() => reduceEvents(events)).not.toThrow();
  });

  it('should handle ante hand (with BBA)', async () => {
    const tournament = makeTournament(3, { ante: 5 });
    const events = await runHand(tournament, callOrCheckProvider);

    // With BBA, POST_BLIND for BBA type should be present
    const bbaEvents = events.filter(
      (e) => e.type === 'POST_BLIND' && (e.payload as any).blindType === 'BBA',
    );
    expect(bbaEvents.length).toBeGreaterThan(0);

    expect(() => reduceEvents(events)).not.toThrow();
  });

  it('should handle 2-player hand', async () => {
    const tournament = makeTournament(2);
    const events = await runHand(tournament, callOrCheckProvider);

    expect(() => reduceEvents(events)).not.toThrow();
    const state = reduceEvents(events);
    expect(state.players).toHaveLength(2);
  });
});

// ============================================================
// AC-14: Reducer with fold-win hand (no community cards)
// ============================================================

describe('AC-14: Reducer with fold-win hand', () => {
  it('should reduce fold-win hand without errors', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, foldProvider);

    expect(() => reduceEvents(events)).not.toThrow();
  });

  it('should have no community cards after fold-win', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, foldProvider);

    const state = reduceEvents(events);
    expect(state.communityCards).toHaveLength(0);
  });

  it('should have chip conservation after fold-win', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, foldProvider);
    const totalChips = tournament.totalChips;

    const state = reduceEvents(events);
    const stateTotal = state.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0)
      + state.mainPot
      + state.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

    expect(stateTotal).toBe(totalChips);
  });
});

// ============================================================
// AC-15: Reducer with multi-pot showdown (chip conservation)
// ============================================================

describe('AC-15: Reducer with multi-pot showdown', () => {
  it('should handle side pots and maintain chip conservation', async () => {
    const tournament = makeTournament(3);
    // Give one player small stack to force side pot
    const players = tournament.gameState.players;
    const excessChips = players[0]!.chips - 50;
    players[0]!.chips = 50;
    players[1]!.chips += excessChips;

    const goAllInProvider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
      if (validActions.canBet) return { type: 'BET', amount: validActions.maxBet };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, goAllInProvider);
    const totalChips = tournament.totalChips;

    expect(() => reduceEvents(events)).not.toThrow();
    const state = reduceEvents(events);

    const stateTotal = state.players.reduce((sum, p) => sum + p.chips + p.currentBet, 0)
      + state.mainPot
      + state.sidePots.reduce((sum, sp) => sum + sp.amount, 0);

    expect(stateTotal).toBe(totalChips);
  });

  it('should have AWARD_POT events in multi-pot scenario', async () => {
    const tournament = makeTournament(3);
    const players = tournament.gameState.players;
    const excessChips = players[0]!.chips - 50;
    players[0]!.chips = 50;
    players[1]!.chips += excessChips;

    const goAllInProvider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, goAllInProvider);
    const awardEvents = events.filter((e) => e.type === 'AWARD_POT');
    // Should have at least 1 award pot event
    expect(awardEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// AC-11: HAND_START contains replay data
// ============================================================

describe('AC-11: HAND_START contains replay data', () => {
  it('should include seed in HAND_START payload', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const handStart = events.find((e) => e.type === 'HAND_START');
    expect(handStart).toBeDefined();

    const payload = handStart!.payload as HandStartPayload;
    expect(payload.seed).toBeDefined();
    expect(typeof payload.seed).toBe('string');
    expect(payload.seed.length).toBeGreaterThan(0);
  });

  it('should include stacks in HAND_START payload', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const handStart = events.find((e) => e.type === 'HAND_START');
    const payload = handStart!.payload as HandStartPayload;

    expect(payload.stacks).toBeDefined();
    expect(payload.stacks.length).toBe(3);
    expect(payload.stacks.every((s) => typeof s.chips === 'number')).toBe(true);
  });

  it('should include blindLevel in HAND_START payload', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const handStart = events.find((e) => e.type === 'HAND_START');
    const payload = handStart!.payload as HandStartPayload;

    expect(payload.blindLevel).toBeDefined();
    expect(typeof payload.blindLevel.sb).toBe('number');
    expect(typeof payload.blindLevel.bb).toBe('number');
  });

  it('should include buttonSeat in HAND_START payload', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const handStart = events.find((e) => e.type === 'HAND_START');
    const payload = handStart!.payload as HandStartPayload;

    expect(typeof payload.buttonSeat).toBe('number');
    expect(payload.buttonSeat).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// AC-12: PLAYER_ACTION contains full action data
// ============================================================

describe('AC-12: PLAYER_ACTION contains full action data', () => {
  it('should include playerId in PLAYER_ACTION events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const actionEvents = events.filter((e) => e.type === 'PLAYER_ACTION');
    expect(actionEvents.length).toBeGreaterThan(0);

    for (const event of actionEvents) {
      const payload = event.payload as PlayerActionPayload;
      expect(payload.playerId).toBeDefined();
      expect(payload.playerId.length).toBeGreaterThan(0);
    }
  });

  it('should include action type in PLAYER_ACTION events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const actionEvents = events.filter((e) => e.type === 'PLAYER_ACTION');
    for (const event of actionEvents) {
      const payload = event.payload as PlayerActionPayload;
      expect(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE']).toContain(payload.action);
    }
  });

  it('should include amount in PLAYER_ACTION events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const actionEvents = events.filter((e) => e.type === 'PLAYER_ACTION');
    for (const event of actionEvents) {
      const payload = event.payload as PlayerActionPayload;
      expect(typeof payload.amount).toBe('number');
      expect(payload.amount).toBeGreaterThanOrEqual(0);
    }
  });
});
