import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveSnapshot, loadSnapshot, deleteSnapshot } from '@/storage/session-store';
import type { TournamentState } from '@/types';

function makeTournamentState(overrides: Partial<TournamentState> = {}): TournamentState {
  return {
    tournamentId: 'test-tournament-1',
    config: {
      playerCount: 8,
      startingChips: 1500,
      handsPerLevel: 10,
      blindSchedule: [{ level: 1, sb: 10, bb: 20, ante: 0 }],
      payoutStructure: 'top3',
      payoutRatios: [0.5, 0.3, 0.2],
      initialSeed: null,
    },
    gameState: {
      phase: 'WAITING',
      players: [],
      communityCards: [],
      mainPot: 0,
      sidePots: [],
      currentPlayerIndex: 0,
      buttonSeatIndex: 0,
      sbSeatIndex: 1,
      bbSeatIndex: 2,
      blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
      handsPlayedInLevel: 0,
      handNumber: 5,
      actionHistory: [],
      bettingRound: {
        street: 'PREFLOP',
        currentBet: 0,
        lastFullRaiseSize: 0,
        lastAggressorId: null,
        actedPlayerIds: [],
        playerLastFacedBet: {},
      },
      seed: 'test-seed',
    },
    eliminations: [],
    standings: [],
    isComplete: false,
    currentBlindLevelIndex: 0,
    totalChips: 12000,
    ...overrides,
  };
}

describe('session-store', () => {
  beforeEach(async () => {
    await deleteSnapshot();
  });

  // AC-4: Session snapshot saved
  it('saves a snapshot and loads it back', async () => {
    const state = makeTournamentState();
    await saveSnapshot(state);
    const loaded = await loadSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.tournamentId).toBe('test-tournament-1');
    expect(loaded?.gameState.handNumber).toBe(5);
  });

  // AC-5: Resume prompt on app load (returns non-null after save)
  it('returns non-null snapshot when one exists', async () => {
    const state = makeTournamentState();
    await saveSnapshot(state);
    const result = await loadSnapshot();
    expect(result).not.toBeNull();
  });

  // AC-6: Resume game on confirm (snapshot is loadable)
  it('loaded snapshot contains full tournament state', async () => {
    const state = makeTournamentState({ totalChips: 12000 });
    await saveSnapshot(state);
    const loaded = await loadSnapshot();
    expect(loaded?.totalChips).toBe(12000);
    expect(loaded?.config.startingChips).toBe(1500);
  });

  // AC-7: New game on decline (snapshot deleted)
  it('deleteSnapshot removes the snapshot', async () => {
    await saveSnapshot(makeTournamentState());
    await deleteSnapshot();
    const loaded = await loadSnapshot();
    expect(loaded).toBeNull();
  });

  // AC-8: Snapshot deleted on tournament end
  it('loadSnapshot returns null when no snapshot stored', async () => {
    const result = await loadSnapshot();
    expect(result).toBeNull();
  });

  it('overwrites previous snapshot on save', async () => {
    await saveSnapshot(makeTournamentState({ tournamentId: 'old-tournament' }));
    await saveSnapshot(makeTournamentState({ tournamentId: 'new-tournament' }));
    const loaded = await loadSnapshot();
    // Should have the latest snapshot
    expect(loaded?.tournamentId).toBe('new-tournament');
  });

  it('handles full round-trip with complex state', async () => {
    const state = makeTournamentState({
      eliminations: [
        { playerId: 'p7', handNumber: 3, finishPosition: 8, chipsAtHandStart: 500, payout: 0 },
      ],
    });
    await saveSnapshot(state);
    const loaded = await loadSnapshot();
    expect(loaded?.eliminations).toHaveLength(1);
    expect(loaded?.eliminations[0]?.playerId).toBe('p7');
  });
});
