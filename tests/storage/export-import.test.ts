import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { exportData, importData } from '@/storage/export-import';
import { clearAllHands, saveHand } from '@/storage/hand-history-store';
import type { StoredHand } from '@/engine/replay';

function makeHandWithId(n: number): StoredHand & { id: string; savedAt: number } {
  return {
    seed: `seed-${n}`,
    playerStacks: { p1: 1500 },
    blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    seatAssignments: [{ playerId: 'p1', seatIndex: 0, name: 'Alice', isHuman: true, aiProfile: null }],
    buttonSeat: 0,
    actions: [],
    events: [],
    id: `hand-${n}`,
    savedAt: Date.now() + n,
  };
}

describe('export-import', () => {
  beforeEach(async () => {
    await clearAllHands();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // AC-15: Export file download
  it('exportData creates a Blob and triggers download', async () => {
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));

    // jsdom does not implement URL.createObjectURL — define it first
    if (!URL.createObjectURL) {
      URL.createObjectURL = () => 'blob:mock-url';
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = () => {};
    }

    const mockUrl = 'blob:mock-url';
    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;

    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

    await exportData();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  // AC-16: Import valid file
  it('importData succeeds with valid export file', async () => {
    await saveHand(makeHandWithId(1));
    await saveHand(makeHandWithId(2));

    // Create a valid export payload
    const { exportPayloadForTest } = await import('@/storage/export-import');
    const payload = await exportPayloadForTest();

    const json = JSON.stringify(payload);
    const file = new File([json], 'export.json', { type: 'application/json' });

    const result = await importData(file);
    expect(result.success).toBe(true);
    expect(result.handsImported).toBe(2);
    expect(result.error).toBeUndefined();
  });

  // AC-17: Import invalid file
  it('importData returns error for invalid JSON', async () => {
    const file = new File(['not valid json{{{'], 'bad.json', { type: 'application/json' });
    const result = await importData(file);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('importData returns error for wrong schema version', async () => {
    const payload = {
      exportDate: new Date().toISOString(),
      schemaVersion: 999, // Wrong version
      handCount: 0,
      hands: [],
      config: {
        playerName: 'Test',
        startingChips: 1500,
        blindSpeed: 'Normal',
        payoutStructure: 'top3',
        customSeed: null,
      },
      customPresets: {},
    };
    const file = new File([JSON.stringify(payload)], 'export.json', { type: 'application/json' });
    const result = await importData(file);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/schema/i);
  });

  it('importData returns error for missing required fields', async () => {
    const incomplete = { exportDate: '2024-01-01', schemaVersion: 1 };
    const file = new File([JSON.stringify(incomplete)], 'export.json', { type: 'application/json' });
    const result = await importData(file);
    expect(result.success).toBe(false);
  });
});
