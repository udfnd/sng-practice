import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveHand, clearAllHands, getHandCount } from '@/storage/hand-history-store';
import { saveSnapshot, loadSnapshot, deleteSnapshot } from '@/storage/session-store';
import { saveConfig, loadConfig } from '@/storage/config-store';
import type { TournamentState } from '@/types';
import type { StoredHand } from '@/engine/replay';

function makeState(): TournamentState {
  return {
    tournamentId: 'integration-test',
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
      handNumber: 10,
      actionHistory: [],
      bettingRound: {
        street: 'PREFLOP',
        currentBet: 0,
        lastFullRaiseSize: 0,
        lastAggressorId: null,
        actedPlayerIds: [],
        playerLastFacedBet: {},
      },
      seed: 'integration-seed',
    },
    eliminations: [],
    standings: [],
    isComplete: false,
    currentBlindLevelIndex: 0,
    totalChips: 12000,
  };
}

function makeHand(n: number): StoredHand & { id: string; savedAt: number } {
  return {
    seed: `seed-${n}`,
    playerStacks: { p1: 1500 },
    blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    seatAssignments: [],
    buttonSeat: 0,
    actions: [],
    events: [],
    id: `hand-${n}`,
    savedAt: Date.now() + n,
  };
}

// AC-18: Reset all data
describe('integration - reset all data', () => {
  beforeEach(async () => {
    await clearAllHands();
    await deleteSnapshot();
    localStorage.clear();
  });

  it('clears all storage systems independently', async () => {
    // Populate all three stores
    await saveHand(makeHand(1));
    await saveHand(makeHand(2));
    await saveSnapshot(makeState());
    saveConfig({ playerName: 'Alice', startingChips: 2000, blindSpeed: 'Fast', payoutStructure: 'top2', customSeed: 'seed' });

    // Verify data exists
    expect(await getHandCount()).toBe(2);
    expect(await loadSnapshot()).not.toBeNull();
    expect(loadConfig().playerName).toBe('Alice');

    // Reset all
    await clearAllHands();
    await deleteSnapshot();
    localStorage.clear();

    // Verify all cleared
    expect(await getHandCount()).toBe(0);
    expect(await loadSnapshot()).toBeNull();
    expect(loadConfig().playerName).toBe('Player'); // default
  });

  it('hand history and session snapshot are independent', async () => {
    await saveHand(makeHand(1));
    await saveSnapshot(makeState());

    // Delete snapshot only
    await deleteSnapshot();
    expect(await getHandCount()).toBe(1); // hand still exists
    expect(await loadSnapshot()).toBeNull();
  });

  it('saving multiple hands does not affect session snapshot', async () => {
    await saveSnapshot(makeState());
    await saveHand(makeHand(1));
    await saveHand(makeHand(2));

    const snapshot = await loadSnapshot();
    expect(snapshot?.gameState.handNumber).toBe(10);
    expect(await getHandCount()).toBe(2);
  });

  it('snapshot overwrites on second save', async () => {
    const state1 = makeState();
    state1.gameState.handNumber = 5;
    await saveSnapshot(state1);

    const state2 = makeState();
    state2.gameState.handNumber = 15;
    await saveSnapshot(state2);

    const loaded = await loadSnapshot();
    expect(loaded?.gameState.handNumber).toBe(15);
  });
});
