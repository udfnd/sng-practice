import { describe, it } from 'vitest';
import { runBatchSimulation, type SimulationConfig } from '@/simulation/batch-runner';
import { PRESETS } from '@/ai/presets';

describe('Station Max VPIP', () => {
  it('should measure Station VPIP with vpip=1.0', async () => {
    // Set Station to play ALL hands
    const orig = { vpip: PRESETS['Station'].vpip, pfr: PRESETS['Station'].pfr,
      openLimpFreq: PRESETS['Station'].openLimpFreq, bbDefenseBase: PRESETS['Station'].bbDefenseBase };
    PRESETS['Station'].vpip = 1.0;
    PRESETS['Station'].pfr = 0.01; // raise rarely
    PRESETS['Station'].openLimpFreq = 0.99; // limp almost all
    PRESETS['Station'].bbDefenseBase = 0.55; // max allowed

    const config: SimulationConfig = {
      sngCount: 50,
      playersPerSNG: 2,
      presetAssignments: { 0: 'Station', 1: 'Station' },
      masterSeed: 'station-max-v1',
    };

    const result = await runBatchSimulation(config);
    const s = result.perPreset['Station'];
    console.log(`Station (vpip=1.0): VPIP=${(s.vpip*100).toFixed(1)}%, PFR=${(s.pfr*100).toFixed(1)}%`);
    console.log(`  Hands: ${s.handsEligible}`);
    
    // Restore
    Object.assign(PRESETS['Station'], orig);
  }, 120_000);
});
