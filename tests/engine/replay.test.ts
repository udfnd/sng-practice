import { describe, it, expect } from 'vitest';
import { runHand, type ActionProvider } from '@/engine/orchestrator';
import { createTournament, createDefaultConfig } from '@/engine/tournament';
import { replayHand, compareEventSequences, type StoredHand } from '@/engine/replay';
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

/**
 * Extract StoredHand from a completed hand's events.
 */
function extractStoredHand(events: GameEvent[], tournament: TournamentState): StoredHand {
  const handStart = events.find((e) => e.type === 'HAND_START')!;
  const payload = handStart.payload as HandStartPayload;

  const playerStacks: Record<string, number> = {};
  for (const stack of payload.stacks) {
    playerStacks[stack.playerId] = stack.chips;
  }

  const actionEvents = events.filter((e) => e.type === 'PLAYER_ACTION');
  const storedActions = actionEvents.map((e) => {
    const ap = e.payload as PlayerActionPayload;
    return { playerId: ap.playerId, action: ap.action, amount: ap.amount };
  });

  // Build seat assignments from tournament state
  const seatAssignments = tournament.gameState.players
    .filter((p) => p.isActive || playerStacks[p.id] !== undefined)
    .map((p) => ({
      playerId: p.id,
      seatIndex: p.seatIndex,
      name: p.name,
      isHuman: p.isHuman,
      aiProfile: p.aiProfile,
    }));

  return {
    seed: payload.seed,
    playerStacks,
    blindLevel: payload.blindLevel,
    seatAssignments,
    buttonSeat: payload.buttonSeat,
    actions: storedActions,
    events,
  };
}

// ============================================================
// AC-7: Deterministic replay - replayed events match original
// ============================================================

describe('AC-7: Deterministic replay - replayed events match original', () => {
  it('should produce identical events when replaying a stored hand', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const comparison = compareEventSequences(originalEvents, replayedEvents);
    expect(comparison.match).toBe(true);
  });

  it('should produce same event types in same order', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const originalTypes = originalEvents.map((e) => e.type);
    const replayedTypes = replayedEvents.map((e) => e.type);

    expect(replayedTypes).toEqual(originalTypes);
  });

  it('should produce same event count when replaying', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    expect(replayedEvents.length).toBe(originalEvents.length);
  });
});

// ============================================================
// AC-8: Same seed twice = identical events
// ============================================================

describe('AC-8: Same seed twice = identical events', () => {
  it('should produce identical events when running same seed twice', async () => {
    const tournament1 = makeTournament(3);
    const events1 = await runHand(tournament1, callOrCheckProvider);

    const storedHand = extractStoredHand(events1, tournament1);

    // Run replay (which uses same seed)
    const events2 = await replayHand(storedHand);

    const comparison = compareEventSequences(events1, events2);
    expect(comparison.match).toBe(true);
  });

  it('should produce same community cards with same seed', async () => {
    const tournament1 = makeTournament(3);
    const events1 = await runHand(tournament1, callOrCheckProvider);

    const storedHand = extractStoredHand(events1, tournament1);
    const events2 = await replayHand(storedHand);

    const communityEvents1 = events1.filter((e) => e.type === 'DEAL_COMMUNITY');
    const communityEvents2 = events2.filter((e) => e.type === 'DEAL_COMMUNITY');

    expect(communityEvents1.length).toBe(communityEvents2.length);

    for (let i = 0; i < communityEvents1.length; i++) {
      expect(JSON.stringify(communityEvents1[i]!.payload)).toBe(
        JSON.stringify(communityEvents2[i]!.payload),
      );
    }
  });
});

// ============================================================
// AC-9: Replay ActionProvider exhaustion
// ============================================================

describe('AC-9: Replay ActionProvider exhaustion', () => {
  it('should use exactly N stored actions during replay', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const actionCount = originalEvents.filter((e) => e.type === 'PLAYER_ACTION').length;
    const storedHand = extractStoredHand(originalEvents, tournament);

    expect(storedHand.actions).toHaveLength(actionCount);

    // Replay should consume all stored actions
    const replayedEvents = await replayHand(storedHand);
    const replayedActionCount = replayedEvents.filter((e) => e.type === 'PLAYER_ACTION').length;

    expect(replayedActionCount).toBe(actionCount);
  });
});

// ============================================================
// AC-10: Event comparison detects divergence at correct index
// ============================================================

describe('AC-10: Event comparison detects divergence at correct index', () => {
  it('should detect no divergence for identical sequences', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const result = compareEventSequences(events, [...events]);
    expect(result.match).toBe(true);
    expect(result.firstDivergenceIndex).toBeNull();
  });

  it('should detect divergence at the correct index', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    // Create a modified copy with a change at index 2
    const modified = events.map((e, i) => {
      if (i === 2) {
        return { ...e, type: 'DEAL_COMMUNITY' as const };
      }
      return e;
    });

    const result = compareEventSequences(events, modified);
    expect(result.match).toBe(false);
    expect(result.firstDivergenceIndex).toBe(2);
  });

  it('should detect length mismatch', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const shorter = events.slice(0, events.length - 1);
    const result = compareEventSequences(events, shorter);
    expect(result.match).toBe(false);
    expect(result.firstDivergenceIndex).not.toBeNull();
  });

  it('should provide details string when there is a divergence', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const modified = events.slice(0, events.length - 2);
    const result = compareEventSequences(events, modified);
    expect(result.match).toBe(false);
    expect(result.details).toBeDefined();
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('should return empty details when sequences match', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const result = compareEventSequences(events, [...events]);
    expect(result.match).toBe(true);
    expect(result.details).toBe('');
  });
});
