import { describe, it } from 'vitest';
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
