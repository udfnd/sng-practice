import { describe, it } from 'vitest';
import { runBatchSimulation } from '@/simulation/batch-runner';
import { PRESETS } from '@/ai/presets';

describe('calibration 300 SNGs', () => {
  it('reports stable stats', async () => {
    const result = await runBatchSimulation({
      sngCount: 300,
      playersPerSNG: 8,
      presetAssignments: {
        0: 'Nit', 1: 'TAG', 2: 'LAG', 3: 'Station',
        4: 'Maniac', 5: 'Shark', 6: 'TAG', 7: 'Nit',
      },
      masterSeed: 'stable-v2',
    });

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
      console.log(`${name.padEnd(8)} VPIP=${fmt(stats.vpip)}(${fmt(t.vpip)},${gap(stats.vpip, t.vpip)}) PFR=${fmt(stats.pfr)}(${fmt(t.pfr)},${gap(stats.pfr, t.pfr)}) 3B=${fmt(stats.threeBet)}(${fmt(t.threeBetFreq)},${gap(stats.threeBet, t.threeBetFreq)})`);
    }
  }, 600_000);
});
