import { describe, it, expect } from 'vitest';
import { runHand, runTournament, type ActionProvider } from '@/engine/orchestrator';
import { createTournament, createDefaultConfig } from '@/engine/tournament';
import { reduceEvents } from '@/engine/event-reducer';
import { replayHand, compareEventSequences, type StoredHand } from '@/engine/replay';
import type { TournamentState, GameEvent, BlindLevel, HandStartPayload, PlayerActionPayload } from '@/types';
import type { BettingPlayer } from '@/engine/betting';
import type { ValidActionsResult } from '@/engine/action-order';

// ============================================================
// Helper factories
// ============================================================

function makeTournament(playerCount: number = 4, overrides?: { ante?: number; handsPerLevel?: number }): TournamentState {
  const blindSchedule: BlindLevel[] = [
    { level: 1, sb: 10, bb: 20, ante: overrides?.ante ?? 0 },
    { level: 2, sb: 15, bb: 30, ante: 5 },
  ];
  const config = createDefaultConfig({
    playerCount: playerCount as 8,
    startingChips: 1500,
    handsPerLevel: overrides?.handsPerLevel ?? 100,
    blindSchedule,
    payoutStructure: 'top3',
    payoutRatios: [0.5, 0.3, 0.2],
    initialSeed: 'parity-test-seed',
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
// Parity tests: reducer matches orchestrator state
// ============================================================

describe('Event sourcing parity: reducer matches orchestrator', () => {
  it('should have same chip totals across multiple hands', async () => {
    const tournament = makeTournament(3);
    const allHandEvents: GameEvent[][] = [];

    // Collect events for 3 hands
    for (let i = 0; i < 3; i++) {
      const events = await runHand(tournament, callOrCheckProvider);
      allHandEvents.push(events);

      // Prepare for next hand
      if (tournament.gameState.phase !== 'WAITING') {
        tournament.gameState.phase = 'HAND_COMPLETE';
        tournament.gameState.phase = 'WAITING';
      }
      for (const p of tournament.gameState.players) {
        if (p.isActive && p.chips === 0) p.isActive = false;
      }
      const activePlayers = tournament.gameState.players.filter((p) => p.isActive);
      if (activePlayers.length < 2) break;
    }

    // Each hand's events should be reducible
    for (const events of allHandEvents) {
      const state = reduceEvents(events);
      expect(state).toBeDefined();
      // Chip conservation
      const total = state.players.reduce((s, p) => s + p.chips + p.currentBet, 0)
        + state.mainPot
        + state.sidePots.reduce((s, sp) => s + sp.amount, 0);
      expect(total).toBe(tournament.totalChips);
    }
  });

  it('should reproduce same hole cards with same seed via replay', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    // Hole card events must match
    const origHoleEvents = originalEvents.filter((e) => e.type === 'DEAL_HOLE');
    const replayHoleEvents = replayedEvents.filter((e) => e.type === 'DEAL_HOLE');

    expect(origHoleEvents.length).toBe(replayHoleEvents.length);
    for (let i = 0; i < origHoleEvents.length; i++) {
      expect(JSON.stringify(origHoleEvents[i]!.payload)).toBe(
        JSON.stringify(replayHoleEvents[i]!.payload),
      );
    }
  });

  it('should reproduce same betting sequence with same actions', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const origActions = originalEvents.filter((e) => e.type === 'PLAYER_ACTION');
    const replayActions = replayedEvents.filter((e) => e.type === 'PLAYER_ACTION');

    expect(origActions.length).toBe(replayActions.length);
    for (let i = 0; i < origActions.length; i++) {
      expect(JSON.stringify(origActions[i]!.payload)).toBe(
        JSON.stringify(replayActions[i]!.payload),
      );
    }
  });

  it('full compareEventSequences should return match=true for replay', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const comparison = compareEventSequences(originalEvents, replayedEvents);
    expect(comparison.match).toBe(true);
    expect(comparison.firstDivergenceIndex).toBeNull();
  });

  it('should reduce replayed events to same chip state as original events', async () => {
    const tournament = makeTournament(3);
    const originalEvents = await runHand(tournament, callOrCheckProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const originalState = reduceEvents(originalEvents);
    const replayedState = reduceEvents(replayedEvents);

    // Same chip counts for all players
    for (const origPlayer of originalState.players) {
      const replayPlayer = replayedState.players.find((p) => p.id === origPlayer.id);
      expect(replayPlayer).toBeDefined();
      expect(replayPlayer!.chips).toBe(origPlayer.chips);
    }
  });

  it('should handle tournament with multiple hands collected as events', async () => {
    const tournament = makeTournament(2);
    const allEvents: GameEvent[] = [];

    await runTournament(tournament, callOrCheckProvider, (event) => {
      allEvents.push(event);
    });

    // All HAND_START events should be identifiable
    const handStartEvents = allEvents.filter((e) => e.type === 'HAND_START');
    expect(handStartEvents.length).toBeGreaterThan(0);

    // Separate by hand number and reduce each
    const handNumbers = new Set(allEvents.map((e) => e.handNumber));
    for (const handNum of handNumbers) {
      const handEvents = allEvents.filter((e) => e.handNumber === handNum);
      if (handEvents.length > 0 && handEvents[0]?.type === 'HAND_START') {
        // Should reduce without error (skip non-hand events)
        const handOnlyEvents = handEvents.filter(
          (e) => !['PLAYER_ELIMINATED', 'BLIND_LEVEL_UP', 'TOURNAMENT_END'].includes(e.type),
        );
        if (handOnlyEvents.length > 0 && handOnlyEvents.some((e) => e.type === 'AWARD_POT')) {
          expect(() => reduceEvents(handOnlyEvents)).not.toThrow();
        }
      }
    }
  });
});

// ============================================================
// Fold-win parity
// ============================================================

describe('Fold-win parity', () => {
  it('should replay fold-win hand identically', async () => {
    const tournament = makeTournament(3);
    const foldProvider: ActionProvider = async (_p, _v) => ({ type: 'FOLD', amount: 0 });
    const originalEvents = await runHand(tournament, foldProvider);

    const storedHand = extractStoredHand(originalEvents, tournament);
    const replayedEvents = await replayHand(storedHand);

    const comparison = compareEventSequences(originalEvents, replayedEvents);
    expect(comparison.match).toBe(true);
  });
});
