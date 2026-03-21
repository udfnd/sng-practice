import { describe, it } from 'vitest';
import { runBatchSimulation } from '@/simulation/batch-runner';
import { PRESETS } from '@/ai/presets';

// Run 600 SNGs across two seeds and average the results for stable calibration measurement.
// Run with: npx vitest run tests/simulation/cal600.test.ts

describe('calibration 600 SNGs (2 seeds averaged)', () => {
  it('reports averaged stats across seeds', async () => {
    const config = {
      sngCount: 300,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit' as const, 1: 'TAG' as const, 2: 'LAG' as const, 3: 'Station' as const,
        4: 'Maniac' as const, 5: 'Shark' as const, 6: 'TAG' as const, 7: 'Nit' as const,
      },
    };

    const [r1, r2] = await Promise.all([
      runBatchSimulation({ ...config, masterSeed: 'tune-v2' }),
      runBatchSimulation({ ...config, masterSeed: 'stable-v2' }),
    ]);

    const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;

    console.log('\n=== Calibration Results (600 SNGs, 2-seed average) ===');
    console.log(
      ['Preset', 'VPIP', 'Target', 'Gap', 'PFR', 'Target', 'Gap', '3Bet', 'Target', 'Gap']
        .map((h) => h.padEnd(8))
        .join(''),
    );

    for (const name of presets) {
      const s1 = r1.perPreset[name];
      const s2 = r2.perPreset[name];
      if (!s1 || !s2) continue;

      const vpip = (s1.vpip + s2.vpip) / 2;
      const pfr = (s1.pfr + s2.pfr) / 2;
      const threeBet = (s1.threeBet + s2.threeBet) / 2;
      const t = PRESETS[name];

      const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
      const gap = (a: number, b: number) => {
        const d = (a - b) * 100;
        return (d >= 0 ? '+' : '') + d.toFixed(1);
      };

      console.log(
        [
          name,
          fmt(vpip), fmt(t.vpip), gap(vpip, t.vpip),
          fmt(pfr), fmt(t.pfr), gap(pfr, t.pfr),
          fmt(threeBet), fmt(t.threeBetFreq), gap(threeBet, t.threeBetFreq),
        ]
          .map((v) => String(v).padEnd(8))
          .join(''),
      );
    }
    console.log('=====================================\n');
  }, 600_000);
});
