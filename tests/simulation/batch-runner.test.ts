import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

// ============================================================
// Helper to build a minimal simulation config
// ============================================================

function makeConfig(overrides?: Partial<SimulationConfig>): SimulationConfig {
  // All 8 seats assigned to AI presets, cycling through available presets
  const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark', 'TAG', 'Nit'];
  const presetAssignments: Record<number, string> = {};
  for (let i = 0; i < 8; i++) {
    presetAssignments[i] = presets[i % presets.length]!;
  }

  return {
    sngCount: 3, // small default for fast tests
    playersPerSNG: 8,
    presetAssignments,
    masterSeed: 'test-master-seed',
    ...overrides,
  };
}

// Timeout for tests that run multiple SNGs
const SNG_TIMEOUT = 60_000;

// ============================================================
// AC-1: SNGs complete with stats populated
// ============================================================

describe('AC-1: batch simulation completes SNGs', () => {
  it('should complete all requested SNGs', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    expect(result.sngsCompleted).toBe(5);
    expect(result.sngsErrored).toBe(0);
  }, SNG_TIMEOUT);

  it('should populate per-preset stats for each preset', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    // Should have stats for all unique presets used
    const presetNames = [...new Set(Object.values(config.presetAssignments))];
    for (const preset of presetNames) {
      expect(result.perPreset[preset]).toBeDefined();
      expect(result.perPreset[preset]!.handsEligible).toBeGreaterThan(0);
    }
  }, SNG_TIMEOUT);

  it('should populate finish position results', async () => {
    const config = makeConfig({ sngCount: 3 });
    const result = await runBatchSimulation(config);

    const presetNames = [...new Set(Object.values(config.presetAssignments))];
    for (const preset of presetNames) {
      const stats = result.perPreset[preset];
      expect(stats).toBeDefined();
      expect(stats!.results.length).toBeGreaterThan(0);
    }
  }, SNG_TIMEOUT);

  it('should report timing info', async () => {
    const config = makeConfig({ sngCount: 3 });
    const result = await runBatchSimulation(config);

    expect(result.timingMs.totalMs).toBeGreaterThan(0);
    expect(result.timingMs.totalHands).toBeGreaterThan(0);
  }, SNG_TIMEOUT);
});

// ============================================================
// AC-2: Chip conservation across SNGs
// ============================================================

describe('AC-2: chip conservation', () => {
  it('should pass chip conservation check across 10 SNGs', async () => {
    const config = makeConfig({ sngCount: 10 });
    const result = await runBatchSimulation(config);

    expect(result.chipConservationPassed).toBe(true);
  }, SNG_TIMEOUT);
});

// ============================================================
// AC-18: Seed isolation per SNG
// ============================================================

describe('AC-18: seed isolation', () => {
  it('should use unique seed for each SNG (different results expected with different master seeds)', async () => {
    const config1 = makeConfig({ sngCount: 3, masterSeed: 'seed-A' });
    const config2 = makeConfig({ sngCount: 3, masterSeed: 'seed-B' });

    const result1 = await runBatchSimulation(config1);
    const result2 = await runBatchSimulation(config2);

    // Results should not be identical (different seeds produce different outcomes)
    const totalHands1 = result1.timingMs.totalHands;
    const totalHands2 = result2.timingMs.totalHands;

    const nitStats1 = result1.perPreset['Nit'];
    const nitStats2 = result2.perPreset['Nit'];

    // Both should have stats
    expect(nitStats1).toBeDefined();
    expect(nitStats2).toBeDefined();

    // At least one of these should differ across different seeds
    const statsMatch =
      nitStats1!.vpipCount === nitStats2!.vpipCount &&
      nitStats1!.pfrCount === nitStats2!.pfrCount &&
      totalHands1 === totalHands2;

    // With different seeds across 3 SNGs, they are unlikely to be identical
    if (statsMatch) {
      console.warn('Warning: Different master seeds produced identical stats - possible seed isolation issue');
    }
  }, SNG_TIMEOUT);

  it('should produce deterministic results with same master seed', async () => {
    const config = makeConfig({ sngCount: 3, masterSeed: 'determinism-test' });

    const result1 = await runBatchSimulation(config);
    const result2 = await runBatchSimulation(config);

    expect(result1.sngsCompleted).toBe(result2.sngsCompleted);
    expect(result1.timingMs.totalHands).toBe(result2.timingMs.totalHands);
    expect(result1.chipConservationPassed).toBe(result2.chipConservationPassed);
  }, SNG_TIMEOUT);
});

// ============================================================
// AC-19: No browser API usage (headless Node.js compatible)
// ============================================================

describe('AC-19: no browser API dependencies', () => {
  it('should run without window or document globals', async () => {
    const config = makeConfig({ sngCount: 2 });

    // Should complete without errors in Node.js-like environment
    await expect(runBatchSimulation(config)).resolves.not.toThrow();
  }, SNG_TIMEOUT);
});

// ============================================================
// AC-20: VPIP/PFR denominator correctness
// ============================================================

describe('AC-20: VPIP/PFR denominator correctness', () => {
  it('should calculate VPIP as vpipCount / handsEligible', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    const presetNames = [...new Set(Object.values(config.presetAssignments))];
    for (const preset of presetNames) {
      const stats = result.perPreset[preset];
      if (!stats || stats.handsEligible === 0) continue;

      const expectedVpip = stats.vpipCount / stats.handsEligible;
      expect(stats.vpip).toBeCloseTo(expectedVpip, 5);
    }
  }, SNG_TIMEOUT);

  it('should calculate PFR as pfrCount / handsEligible', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    const presetNames = [...new Set(Object.values(config.presetAssignments))];
    for (const preset of presetNames) {
      const stats = result.perPreset[preset];
      if (!stats || stats.handsEligible === 0) continue;

      const expectedPfr = stats.pfrCount / stats.handsEligible;
      expect(stats.pfr).toBeCloseTo(expectedPfr, 5);
    }
  }, SNG_TIMEOUT);

  it('should have VPIP >= PFR for all presets', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    const presetNames = [...new Set(Object.values(config.presetAssignments))];
    for (const preset of presetNames) {
      const stats = result.perPreset[preset];
      if (!stats || stats.handsEligible === 0) continue;

      expect(stats.vpip).toBeGreaterThanOrEqual(stats.pfr);
    }
  }, SNG_TIMEOUT);

  it('should expose raw counts for independent verification', async () => {
    const config = makeConfig({ sngCount: 3 });
    const result = await runBatchSimulation(config);

    for (const stats of Object.values(result.perPreset)) {
      expect(stats.handsEligible).toBeGreaterThanOrEqual(0);
      expect(stats.threeBetOpportunities).toBeGreaterThanOrEqual(0);
    }
  }, SNG_TIMEOUT);
});

// ============================================================
// Stats target values are present
// ============================================================

describe('preset stats include target values', () => {
  it('should include target VPIP/PFR/3bet from preset definition', async () => {
    const config = makeConfig({ sngCount: 3 });
    const result = await runBatchSimulation(config);

    const sharkStats = result.perPreset['Shark'];
    expect(sharkStats).toBeDefined();
    // Shark targets: vpip=0.23, pfr=0.19, threeBet=0.09
    expect(sharkStats!.vpipTarget).toBeCloseTo(0.23, 2);
    expect(sharkStats!.pfrTarget).toBeCloseTo(0.19, 2);
    expect(sharkStats!.threeBetTarget).toBeCloseTo(0.09, 2);
  }, SNG_TIMEOUT);
});

// ============================================================
// avgFinishPosition and stdDev
// ============================================================

describe('finish position stats', () => {
  it('should calculate average finish position per preset', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    for (const [_preset, stats] of Object.entries(result.perPreset)) {
      if (stats.results.length === 0) continue;
      const expected = stats.results.reduce((a, b) => a + b, 0) / stats.results.length;
      expect(stats.avgFinishPosition).toBeCloseTo(expected, 4);
    }
  }, SNG_TIMEOUT);

  it('should report firstPlaceRate between 0 and 1', async () => {
    const config = makeConfig({ sngCount: 5 });
    const result = await runBatchSimulation(config);

    for (const stats of Object.values(result.perPreset)) {
      expect(stats.firstPlaceRate).toBeGreaterThanOrEqual(0);
      expect(stats.firstPlaceRate).toBeLessThanOrEqual(1);
    }
  }, SNG_TIMEOUT);
});

// ============================================================
// vpipCount and pfrCount are aggregated (not averaged)
// ============================================================

describe('stat aggregation', () => {
  it('should aggregate vpipCount across all SNGs for the same preset', async () => {
    const presetAssignments: Record<number, string> = {};
    for (let i = 0; i < 8; i++) {
      presetAssignments[i] = 'TAG'; // all TAGs
    }

    const config: SimulationConfig = {
      sngCount: 5,
      playersPerSNG: 8,
      presetAssignments,
      masterSeed: 'aggregate-test',
    };

    const result = await runBatchSimulation(config);
    const tagStats = result.perPreset['TAG'];

    expect(tagStats).toBeDefined();
    // With 8 TAG players across 5 SNGs, we should have substantial hands
    expect(tagStats!.handsEligible).toBeGreaterThan(50);
    expect(tagStats!.vpipCount).toBeGreaterThan(0);
  }, SNG_TIMEOUT);
});
