import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveHand,
  getHand,
  getAllHands,
  getHandCount,
  deleteOldestHands,
  clearAllHands,
} from '@/storage/hand-history-store';
import type { StoredHand } from '@/engine/replay';

function makeHand(id: string, overrides: Partial<StoredHand> = {}): StoredHand {
  return {
    seed: 'seed-' + id,
    playerStacks: { p1: 1500 },
    blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    seatAssignments: [{ playerId: 'p1', seatIndex: 0, name: 'Alice', isHuman: true, aiProfile: null }],
    buttonSeat: 0,
    actions: [],
    events: [],
    ...overrides,
  };
}

// Assign a stable id field for keyPath
function makeHandWithId(n: number): StoredHand & { id: string; savedAt: number } {
  return {
    ...makeHand(String(n)),
    id: `hand-${n}`,
    savedAt: Date.now() + n,
  };
}

describe('hand-history-store', () => {
  beforeEach(async () => {
    await clearAllHands();
  });

  // AC-1: Hand saved after completion
  it('saves a hand and retrieves it by id', async () => {
    const hand = makeHandWithId(1);
    await saveHand(hand);
    const retrieved = await getHand('hand-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.seed).toBe('seed-1');
  });

  it('returns null for non-existent hand id', async () => {
    const result = await getHand('nonexistent');
    expect(result).toBeNull();
  });

  it('getAllHands returns all stored hands', async () => {
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));
    await saveHand(makeHandWithId(3));
    const all = await getAllHands();
    expect(all).toHaveLength(3);
  });

  it('getHandCount returns correct count', async () => {
    expect(await getHandCount()).toBe(0);
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));
    expect(await getHandCount()).toBe(2);
  });

  // AC-2: FIFO at 1000 hands
  it('enforces FIFO limit of 1000 hands', async () => {
    // Save 1005 hands - oldest should be deleted
    const batchSize = 50;
    for (let batch = 0; batch < 21; batch++) {
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        const n = batch * batchSize + i + 1;
        if (n <= 1005) {
          promises.push(saveHand(makeHandWithId(n)));
        }
      }
      await Promise.all(promises);
    }

    const count = await getHandCount();
    expect(count).toBeLessThanOrEqual(1000);
  }, 30000);

  // AC-3: FIFO below limit (no deletion)
  it('does not delete when under limit', async () => {
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));
    await saveHand(makeHandWithId(3));
    const count = await getHandCount();
    expect(count).toBe(3);
  });

  it('deleteOldestHands removes the specified count', async () => {
    await saveHand({ ...makeHandWithId(1), savedAt: 100 });
    await saveHand({ ...makeHandWithId(2), savedAt: 200 });
    await saveHand({ ...makeHandWithId(3), savedAt: 300 });

    await deleteOldestHands(2);
    const count = await getHandCount();
    expect(count).toBe(1);
  });

  it('clearAllHands removes everything', async () => {
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));
    await clearAllHands();
    expect(await getHandCount()).toBe(0);
  });
});
