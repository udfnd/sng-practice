import { describe, it } from 'vitest';
import { runBatchSimulation } from '@/simulation/batch-runner';
import { PRESETS } from '@/ai/presets';

// ============================================================
// Quick calibration measurement — always runs, no assertions.
// Reports actual vs target for all presets.
// Run with: npx vitest run tests/simulation/calibration-measure.test.ts
// ============================================================

describe('calibration: measure all presets (100 SNGs)', () => {
  it('reports VPIP/PFR/3-Bet vs targets', async () => {
    const result = await runBatchSimulation({
      sngCount: 100,
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
      masterSeed: 'tune-v2',
    });

    console.log('\n=== Calibration Results (100 SNGs) ===');
    console.log(
      ['Preset', 'VPIP', 'Target', 'Gap', 'PFR', 'Target', 'Gap', '3Bet', 'Target', 'Gap']
        .map((h) => h.padEnd(8))
        .join(''),
    );

    const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;
    for (const name of presets) {
      const stats = result.perPreset[name];
      if (!stats) continue;
      const t = PRESETS[name];
      const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
      const gap = (a: number, b: number) => {
        const d = (a - b) * 100;
        return (d >= 0 ? '+' : '') + d.toFixed(1);
      };
      console.log(
        [
          name,
          fmt(stats.vpip),
          fmt(t.vpip),
          gap(stats.vpip, t.vpip),
          fmt(stats.pfr),
          fmt(t.pfr),
          gap(stats.pfr, t.pfr),
          fmt(stats.threeBet),
          fmt(t.threeBetFreq),
          gap(stats.threeBet, t.threeBetFreq),
        ]
          .map((v) => String(v).padEnd(8))
          .join(''),
      );
    }
    console.log('=====================================\n');
  }, 300_000);
});
