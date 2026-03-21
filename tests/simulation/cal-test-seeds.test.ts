import { describe, it } from 'vitest';
import { runBatchSimulation } from '@/simulation/batch-runner';
import { PRESETS } from '@/ai/presets';
import type { PresetType } from '@/types';

// Measure calibration using paired seeds matching calibration.test.ts
// Run with: npx vitest run tests/simulation/cal-test-seeds.test.ts

async function runAveragedAndPrint(
  label: string,
  sngCount: number,
  seedA: string,
  seedB: string,
): Promise<void> {
  const cfg = (seed: string) => ({
    sngCount,
    playersPerSNG: 8,
    presetAssignments: {
      0: 'Nit' as const, 1: 'TAG' as const, 2: 'LAG' as const, 3: 'Station' as const,
      4: 'Maniac' as const, 5: 'Shark' as const, 6: 'TAG' as const, 7: 'Nit' as const,
    },
    masterSeed: seed,
  });

  const [r1, r2] = await Promise.all([
    runBatchSimulation(cfg(seedA)),
    runBatchSimulation(cfg(seedB)),
  ]);

  const presets = ['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark'] as const;
  console.log(`\n=== ${label} (${sngCount * 2} SNGs avg: ${seedA} + ${seedB}) ===`);
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
    const t = PRESETS[name as PresetType];
    const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;
    const gap = (a: number, b: number) => {
      const d = (a - b) * 100;
      return (d >= 0 ? '+' : '') + d.toFixed(1);
    };
    console.log(
      [name, fmt(vpip), fmt(t.vpip), gap(vpip, t.vpip),
       fmt(pfr), fmt(t.pfr), gap(pfr, t.pfr),
       fmt(threeBet), fmt(t.threeBetFreq), gap(threeBet, t.threeBetFreq)]
        .map((v) => String(v).padEnd(8)).join(''),
    );
  }
}

describe('calibration against formal test seeds', () => {
  it('VPIP test pair', async () => {
    await runAveragedAndPrint('VPIP test', 300, 'all-presets-calibration', 'all-presets-calibration-b');
  }, 600_000);

  it('PFR test pair', async () => {
    await runAveragedAndPrint('PFR test', 300, 'all-presets-pfr-calibration', 'all-presets-pfr-calibration-b');
  }, 600_000);

  it('Shark test pair', async () => {
    await runAveragedAndPrint('Shark tests', 300, 'calibration-master-seed', 'calibration-seed-b');
  }, 600_000);
});
