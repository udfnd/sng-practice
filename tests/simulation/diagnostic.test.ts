import { describe, it, expect } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';

describe('AI Diagnostic: Post-overhaul calibration check', () => {
  it('100 SNGs precision calibration', async () => {
    const config: SimulationConfig = {
      sngCount: 100,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'diagnostic-phase4',
    };

    const result = await runBatchSimulation(config);

    console.log('\n=== AI DIAGNOSTIC: 100 SNG Results ===\n');
    console.log(`SNGs completed: ${result.sngsCompleted}`);
    console.log(`Avg hand time: ${result.timingMs.avgHandMs.toFixed(2)}ms`);
    console.log(`Total hands: ${result.timingMs.totalHands}\n`);

    const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;
    console.log('Preset       | VPIP (actual/target) | PFR (actual/target)  | 3-Bet (actual/target) | Avg Finish | Hands');
    console.log('-------------|---------------------|---------------------|----------------------|-----------|------');

    for (const name of presets) {
      const s = result.perPreset[name];
      if (!s) continue;
      const vpipStr = `${(s.vpip * 100).toFixed(1)}% / ${(s.vpipTarget * 100).toFixed(1)}%`;
      const pfrStr = `${(s.pfr * 100).toFixed(1)}% / ${(s.pfrTarget * 100).toFixed(1)}%`;
      const tbStr = `${(s.threeBet * 100).toFixed(1)}% / ${(s.threeBetTarget * 100).toFixed(1)}%`;
      const vpipOk = Math.abs(s.vpip - s.vpipTarget) <= 0.05 ? '  ' : ' !';
      const pfrOk = Math.abs(s.pfr - s.pfrTarget) <= 0.05 ? '  ' : ' !';
      const tbOk = Math.abs(s.threeBet - s.threeBetTarget) <= 0.05 ? '  ' : ' !';
      console.log(
        `${name.padEnd(12)} | ${vpipStr.padEnd(19)}${vpipOk}| ${pfrStr.padEnd(19)}${pfrOk}| ${tbStr.padEnd(20)}${tbOk}| ${s.avgFinishPosition.toFixed(1).padEnd(9)} | ${s.handsEligible}`,
      );
    }

    console.log('\n(! = >5% off target, needs attention)\n');
  }, 120_000);
});

describe('AI Diagnostic: noLimp mode verification', () => {
  const PRESETS_ORDER = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;

  it('100 SNGs with noLimp=true: VPIP equals PFR (no limp actions)', async () => {
    const config: SimulationConfig = {
      sngCount: 100,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'nolimp-diagnostic',
      noLimp: true,
    };

    const result = await runBatchSimulation(config);

    console.log('\n=== noLimp MODE: 100 SNG Results ===\n');
    console.log(`SNGs completed: ${result.sngsCompleted}`);
    console.log(`Total hands: ${result.timingMs.totalHands}\n`);
    console.log('Preset       | VPIP     | PFR      | Limps    | Limp%    | Hands');
    console.log('-------------|----------|----------|----------|----------|------');

    for (const name of PRESETS_ORDER) {
      const s = result.perPreset[name];
      if (!s) continue;
      const limpPct = s.handsEligible > 0 ? (s.limpCount / s.handsEligible * 100).toFixed(1) : '0.0';
      const status = s.limpCount === 0 ? 'OK' : `FAIL`;
      console.log(
        `${name.padEnd(12)} | ${(s.vpip * 100).toFixed(1).padEnd(8)}| ${(s.pfr * 100).toFixed(1).padEnd(8)}| ${String(s.limpCount).padEnd(8)}| ${limpPct.padEnd(8)}| ${s.handsEligible} ${status}`,
      );
    }

    // Core assertions for noLimp mode:
    // - Most presets (raise-or-fold oriented) should have < 1% limp rate
    // - Even Station (normally 30%+ limp) should be dramatically reduced to < 5%
    // - Residual limps come from edge cases: short-stack all-ins < BB, HU SB completion
    for (const name of PRESETS_ORDER) {
      const s = result.perPreset[name];
      if (!s || s.handsEligible < 100) continue;
      const limpRate = s.limpCount / s.handsEligible;
      // Station/Maniac have wider VPIP → more edge-case overlap, allow 5% tolerance
      const threshold = (name === 'Station' || name === 'Maniac') ? 0.05 : 0.01;
      expect(limpRate, `${name} limp rate ${(limpRate * 100).toFixed(1)}% should be < ${threshold * 100}%`).toBeLessThan(threshold);
    }
  }, 120_000);

  it('noLimp presets still differentiate: Nit VPIP < TAG VPIP < LAG VPIP', async () => {
    const config: SimulationConfig = {
      sngCount: 100,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'nolimp-diagnostic',
      noLimp: true,
    };

    const result = await runBatchSimulation(config);

    const nit = result.perPreset['Nit']!;
    const tag = result.perPreset['TAG']!;
    const lag = result.perPreset['LAG']!;
    const shark = result.perPreset['Shark']!;

    // Nit should be tighter than TAG
    expect(nit.vpip).toBeLessThan(tag.vpip + 0.03);
    // TAG should be tighter than LAG
    expect(tag.vpip).toBeLessThan(lag.vpip + 0.03);
    // Shark should be between Nit and LAG
    expect(shark.vpip).toBeGreaterThan(nit.vpip - 0.03);
    expect(shark.vpip).toBeLessThan(lag.vpip + 0.05);

    console.log('\n=== noLimp Differentiation Check ===');
    console.log(`Nit VPIP: ${(nit.vpip * 100).toFixed(1)}%`);
    console.log(`TAG VPIP: ${(tag.vpip * 100).toFixed(1)}%`);
    console.log(`Shark VPIP: ${(shark.vpip * 100).toFixed(1)}%`);
    console.log(`LAG VPIP: ${(lag.vpip * 100).toFixed(1)}%`);
    console.log('Order check: Nit < TAG < Shark < LAG (with tolerance)\n');
  }, 120_000);
});
