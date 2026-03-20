import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

// ============================================================
// Performance benchmarks
// AC-13: Hand speed < 5ms average
// AC-14: 10K hands < 60s
// AC-15: 1K SNG < 10min (600s)
//
// AC-13 and fast subset always run; AC-14/AC-15 are slow
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RUN_SIM = (globalThis as any).process?.env?.['RUN_SIM'] === 'true';

// ============================================================
// AC-13: Hand speed < 5ms (fast test with 5 SNGs)
// ============================================================

describe('AC-13: hand speed', () => {
  it('average hand execution should be under 5ms', async () => {
    const config: SimulationConfig = {
      sngCount: 5,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'TAG', 1: 'TAG', 2: 'TAG', 3: 'TAG',
        4: 'TAG', 5: 'TAG', 6: 'TAG', 7: 'TAG',
      },
      masterSeed: 'perf-test-hands',
    };

    const result = await runBatchSimulation(config);

    expect(result.timingMs.totalHands).toBeGreaterThan(0);
    expect(result.timingMs.avgHandMs).toBeLessThan(5);
  }, 60_000);
});

// ============================================================
// AC-14: 10K hands < 60s
// ============================================================

describe.skipIf(!RUN_SIM)('AC-14: 10K hands under 60s', () => {
  it('10000 hands should complete in under 60 seconds', async () => {
    // With ~50-70 hands per SNG, we need ~150-200 SNGs for 10K hands
    const config: SimulationConfig = {
      sngCount: 200,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'TAG', 1: 'TAG', 2: 'TAG', 3: 'TAG',
        4: 'TAG', 5: 'TAG', 6: 'TAG', 7: 'TAG',
      },
      masterSeed: 'perf-10k-hands',
    };

    const result = await runBatchSimulation(config);

    if (result.timingMs.totalHands >= 10000) {
      const msFor10k = (result.timingMs.totalMs / result.timingMs.totalHands) * 10000;
      expect(msFor10k).toBeLessThan(60_000);
    }

    // Just verify the batch ran in reasonable time
    expect(result.timingMs.totalMs).toBeLessThan(60_000);
  }, 300_000);
});

// ============================================================
// AC-15: 1K SNG < 10min (600s)
// ============================================================

describe.skipIf(!RUN_SIM)('AC-15: 1K SNG under 10 minutes', () => {
  it('1000 SNGs should complete in under 10 minutes', async () => {
    const config: SimulationConfig = {
      sngCount: 1000,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'perf-1k-sng',
    };

    const result = await runBatchSimulation(config);

    expect(result.timingMs.totalMs).toBeLessThan(600_000);
    expect(result.sngsCompleted).toBe(1000);
  }, 660_000);
});

// ============================================================
// Performance reporting
// ============================================================

describe('performance reporting', () => {
  it('should report avgHandMs in result', async () => {
    const config: SimulationConfig = {
      sngCount: 3,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'TAG', 1: 'TAG', 2: 'TAG', 3: 'TAG',
        4: 'TAG', 5: 'TAG', 6: 'TAG', 7: 'TAG',
      },
      masterSeed: 'perf-report',
    };

    const result = await runBatchSimulation(config);

    expect(result.timingMs.avgHandMs).toBeGreaterThan(0);
    expect(result.timingMs.totalHands).toBeGreaterThan(0);
    expect(result.timingMs.totalMs).toBeGreaterThan(0);

    // Verify avgHandMs is consistent with totalMs / totalHands
    const calculatedAvg = result.timingMs.totalMs / result.timingMs.totalHands;
    expect(result.timingMs.avgHandMs).toBeCloseTo(calculatedAvg, 1);
  }, 60_000);
});
