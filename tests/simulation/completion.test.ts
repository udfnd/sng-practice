import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

// ============================================================
// SLOW completion tests - skip for CI
// Run with: RUN_SIM=true npx vitest run tests/simulation/completion.test.ts
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RUN_SIM = (globalThis as any).process?.env?.['RUN_SIM'] === 'true';

// ============================================================
// AC-7: 1K SNG completion (run with smaller count for fast test)
// ============================================================

describe.skipIf(!RUN_SIM)('AC-7: tournament completion rate', () => {
  it('should complete 50 SNGs without errors', async () => {
    const config: SimulationConfig = {
      sngCount: 50,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'completion-test-50',
    };

    const result = await runBatchSimulation(config);

    expect(result.sngsCompleted).toBe(50);
    expect(result.sngsErrored).toBe(0);
    expect(result.chipConservationPassed).toBe(true);
  }, 60_000);

  it('should complete 1000 SNGs (full AC-7 test)', async () => {
    const config: SimulationConfig = {
      sngCount: 1000,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'completion-test-1000',
    };

    const result = await runBatchSimulation(config);

    expect(result.sngsCompleted).toBe(1000);
    expect(result.sngsErrored).toBe(0);
    expect(result.chipConservationPassed).toBe(true);
  }, 600_000);
});

// Fast smoke test - always runs
describe('completion smoke test', () => {
  it('should complete 3 SNGs without errors', async () => {
    const config: SimulationConfig = {
      sngCount: 3,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'smoke-test',
    };

    const result = await runBatchSimulation(config);

    expect(result.sngsCompleted).toBe(3);
    expect(result.sngsErrored).toBe(0);
    expect(result.chipConservationPassed).toBe(true);
  }, 30_000);
});
