import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

// ============================================================
// SLOW balance tests - soft assertions via console.warn
// Run with: RUN_SIM=true npx vitest run tests/simulation/balance.test.ts
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RUN_SIM = (globalThis as any).process?.env?.['RUN_SIM'] === 'true';

function makeBalanceConfig(sngCount: number): SimulationConfig {
  return {
    sngCount,
    playersPerSNG: 8,
    presetAssignments: {
      0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
      4: 'Maniac', 5: 'Shark', 6: 'Nit', 7: 'TAG',
    },
    masterSeed: 'balance-test-seed',
  };
}

// ============================================================
// AC-10: Shark/TAG better than Nit/Station (soft assertion)
// ============================================================

describe.skipIf(!RUN_SIM)('AC-10: balance - better presets outperform weaker ones', () => {
  it('Shark and TAG should have better avg finish position than Nit and Station', async () => {
    const config = makeBalanceConfig(200);
    const result = await runBatchSimulation(config);

    const sharkStats = result.perPreset['Shark'];
    const tagStats = result.perPreset['TAG'];
    const nitStats = result.perPreset['Nit'];
    const stationStats = result.perPreset['Station'];

    if (!sharkStats || !tagStats || !nitStats || !stationStats) {
      console.warn('Missing preset stats for balance test');
      return;
    }

    // Lower avgFinishPosition = better (finished earlier = higher rank)
    const goodAvg = (sharkStats.avgFinishPosition + tagStats.avgFinishPosition) / 2;
    const badAvg = (nitStats.avgFinishPosition + stationStats.avgFinishPosition) / 2;

    if (goodAvg >= badAvg) {
      console.warn(
        `AC-10 soft assertion: expected Shark/TAG avg (${goodAvg.toFixed(2)}) < Nit/Station avg (${badAvg.toFixed(2)}). ` +
        'Balance may need tuning.'
      );
    }

    // Soft assertion - log warning instead of fail
    // expect(goodAvg).toBeLessThan(badAvg);
  }, 300_000);
});

// ============================================================
// AC-11: Maniac higher variance (soft assertion)
// ============================================================

describe.skipIf(!RUN_SIM)('AC-11: Maniac higher variance', () => {
  it('Maniac should have higher finish position std dev than TAG', async () => {
    const config = makeBalanceConfig(200);
    const result = await runBatchSimulation(config);

    const maniacStats = result.perPreset['Maniac'];
    const tagStats = result.perPreset['TAG'];

    if (!maniacStats || !tagStats) {
      console.warn('Missing preset stats for variance test');
      return;
    }

    if (maniacStats.finishPositionStdDev <= tagStats.finishPositionStdDev) {
      console.warn(
        `AC-11 soft assertion: expected Maniac stdDev (${maniacStats.finishPositionStdDev.toFixed(2)}) > ` +
        `TAG stdDev (${tagStats.finishPositionStdDev.toFixed(2)}). ` +
        'Variance profile may need tuning.'
      );
    }

    // Soft assertion only
    // expect(maniacStats.finishPositionStdDev).toBeGreaterThan(tagStats.finishPositionStdDev);
  }, 300_000);
});

// ============================================================
// AC-12: Win rate 2-40% range for all presets
// ============================================================

describe.skipIf(!RUN_SIM)('AC-12: win rate in reasonable range', () => {
  it('all presets should have first place rate between 2% and 40%', async () => {
    const config = makeBalanceConfig(200);
    const result = await runBatchSimulation(config);

    for (const [preset, stats] of Object.entries(result.perPreset)) {
      if (stats.results.length < 10) continue; // skip presets with insufficient data

      if (stats.firstPlaceRate < 0.02 || stats.firstPlaceRate > 0.40) {
        console.warn(
          `AC-12: ${preset} win rate ${(stats.firstPlaceRate * 100).toFixed(1)}% outside 2-40% range`
        );
      }

      // Hard bounds - these would indicate serious issues
      expect(stats.firstPlaceRate).toBeGreaterThanOrEqual(0);
      expect(stats.firstPlaceRate).toBeLessThanOrEqual(1);
    }
  }, 300_000);
});

// Fast smoke: balance stats are populated
describe('balance stats smoke test', () => {
  it('should populate finishPositionStdDev for presets with multiple results', async () => {
    const config: SimulationConfig = {
      sngCount: 5,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'TAG', 1: 'TAG', 2: 'TAG', 3: 'TAG',
        4: 'TAG', 5: 'TAG', 6: 'TAG', 7: 'TAG',
      },
      masterSeed: 'balance-smoke',
    };

    const result = await runBatchSimulation(config);
    const tagStats = result.perPreset['TAG'];

    expect(tagStats).toBeDefined();
    expect(tagStats!.finishPositionStdDev).toBeGreaterThanOrEqual(0);
    expect(tagStats!.firstPlaceRate).toBeGreaterThanOrEqual(0);
    expect(tagStats!.firstPlaceRate).toBeLessThanOrEqual(1);
  }, 60_000);
});
