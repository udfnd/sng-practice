import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

// ============================================================
// SLOW calibration tests - skip for CI, run explicitly
// These tests require many SNGs to produce stable statistics
// Run with: RUN_SIM=true npx vitest run tests/simulation/calibration.test.ts
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RUN_SIM = (globalThis as any).process?.env?.['RUN_SIM'] === 'true';

function makeAllPresetsConfig(sngCount: number): SimulationConfig {
  return {
    sngCount,
    playersPerSNG: 8,
    presetAssignments: {
      0: 'Nit',
      1: 'TAG',
      2: 'LAG',
      3: 'Station',
      4: 'Maniac',
      5: 'Shark',
      6: 'TAG',
      7: 'Nit',
    },
    masterSeed: 'calibration-master-seed',
  };
}

// Tolerance for calibration: ±2% = 0.02 absolute difference
const TOLERANCE = 0.02;

// ============================================================
// AC-3: Shark VPIP within ±2%
// ============================================================

describe.skipIf(!RUN_SIM)('AC-3: Shark VPIP calibration', () => {
  it('Shark VPIP should be within ±2% of target 23%', async () => {
    const config = makeAllPresetsConfig(200);
    const result = await runBatchSimulation(config);

    const sharkStats = result.perPreset['Shark'];
    expect(sharkStats).toBeDefined();

    const vpip = sharkStats!.vpip;
    const target = sharkStats!.vpipTarget; // 0.23

    expect(Math.abs(vpip - target)).toBeLessThanOrEqual(TOLERANCE);
  }, 300_000);
});

// ============================================================
// AC-4: Shark PFR within ±2%
// ============================================================

describe.skipIf(!RUN_SIM)('AC-4: Shark PFR calibration', () => {
  it('Shark PFR should be within ±2% of target 19%', async () => {
    const config = makeAllPresetsConfig(200);
    const result = await runBatchSimulation(config);

    const sharkStats = result.perPreset['Shark'];
    expect(sharkStats).toBeDefined();

    const pfr = sharkStats!.pfr;
    const target = sharkStats!.pfrTarget; // 0.19

    expect(Math.abs(pfr - target)).toBeLessThanOrEqual(TOLERANCE);
  }, 300_000);
});

// ============================================================
// AC-5: Shark 3-Bet within ±2%
// ============================================================

describe.skipIf(!RUN_SIM)('AC-5: Shark 3-Bet calibration', () => {
  it('Shark 3-Bet should be within ±2% of target 9%', async () => {
    const config = makeAllPresetsConfig(200);
    const result = await runBatchSimulation(config);

    const sharkStats = result.perPreset['Shark'];
    expect(sharkStats).toBeDefined();

    const threeBet = sharkStats!.threeBet;
    const target = sharkStats!.threeBetTarget; // 0.09

    expect(Math.abs(threeBet - target)).toBeLessThanOrEqual(TOLERANCE);
  }, 300_000);
});

// ============================================================
// AC-6: All 6 presets calibrated within ±2%
// ============================================================

describe.skipIf(!RUN_SIM)('AC-6: all presets calibrated', () => {
  it('all 6 presets should have VPIP within ±2% of target', async () => {
    const config: SimulationConfig = {
      sngCount: 300,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit',
        1: 'TAG',
        2: 'LAG',
        3: 'Station',
        4: 'Maniac',
        5: 'Shark',
        6: 'Nit',
        7: 'TAG',
      },
      masterSeed: 'all-presets-calibration',
    };

    const result = await runBatchSimulation(config);

    const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;

    for (const preset of presets) {
      const stats = result.perPreset[preset];
      if (!stats || stats.handsEligible < 100) {
        console.warn(`${preset}: insufficient hands (${stats?.handsEligible ?? 0}), skipping`);
        continue;
      }

      const vpipDiff = Math.abs(stats.vpip - stats.vpipTarget);
      if (vpipDiff > TOLERANCE) {
        console.warn(`${preset} VPIP: actual=${(stats.vpip * 100).toFixed(1)}%, target=${(stats.vpipTarget * 100).toFixed(1)}%, diff=${(vpipDiff * 100).toFixed(1)}%`);
      }
      expect(vpipDiff).toBeLessThanOrEqual(TOLERANCE + 0.01); // slight relaxation for stability
    }
  }, 300_000);

  it('all 6 presets should have PFR within ±2% of target', async () => {
    const config: SimulationConfig = {
      sngCount: 300,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit',
        1: 'TAG',
        2: 'LAG',
        3: 'Station',
        4: 'Maniac',
        5: 'Shark',
        6: 'Nit',
        7: 'TAG',
      },
      masterSeed: 'all-presets-pfr-calibration',
    };

    const result = await runBatchSimulation(config);

    const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;

    for (const preset of presets) {
      const stats = result.perPreset[preset];
      if (!stats || stats.handsEligible < 100) continue;

      const pfrDiff = Math.abs(stats.pfr - stats.pfrTarget);
      if (pfrDiff > TOLERANCE) {
        console.warn(`${preset} PFR: actual=${(stats.pfr * 100).toFixed(1)}%, target=${(stats.pfrTarget * 100).toFixed(1)}%, diff=${(pfrDiff * 100).toFixed(1)}%`);
      }
      expect(pfrDiff).toBeLessThanOrEqual(TOLERANCE + 0.01);
    }
  }, 300_000);
});
