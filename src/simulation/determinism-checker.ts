import { runBatchSimulation, type SimulationConfig } from './batch-runner';

// ============================================================
// Public types
// ============================================================

export interface DeterminismResult {
  passed: boolean;
  runs: number;
  firstDivergenceRun?: number;
  details?: string;
}

// ============================================================
// Determinism checker
// ============================================================

/**
 * Run the same SNG configuration `runs` times and compare standings.
 * If all runs produce identical standings, returns passed=true.
 */
export async function checkDeterminism(config: {
  seed: string;
  playersPerSNG: number;
  presetAssignments: Record<number, string>;
  runs: number;
}): Promise<DeterminismResult> {
  const { seed, playersPerSNG, presetAssignments, runs } = config;

  // Build a simulation config for a single SNG with a fixed seed
  const simConfig: SimulationConfig = {
    sngCount: 1,
    playersPerSNG,
    presetAssignments,
    masterSeed: seed,
  };

  // Run the first time to get baseline standings
  const baseline = await runSingleSNG(simConfig);

  // Compare subsequent runs against baseline
  for (let run = 2; run <= runs; run++) {
    const current = await runSingleSNG(simConfig);

    if (!standingsMatch(baseline, current)) {
      return {
        passed: false,
        runs,
        firstDivergenceRun: run,
        details: buildDivergenceDetails(baseline, current, run),
      };
    }
  }

  return {
    passed: true,
    runs,
  };
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Run a single SNG and extract standings as a comparable format.
 */
async function runSingleSNG(
  config: SimulationConfig,
): Promise<StandingEntry[]> {
  const result = await runBatchSimulation(config);

  // We infer the standings from perPreset results (finish positions)
  // Each preset accumulates results[] with finish positions
  const entries: StandingEntry[] = [];

  for (const [preset, stats] of Object.entries(result.perPreset)) {
    for (let i = 0; i < stats.results.length; i++) {
      entries.push({ preset, position: stats.results[i]!, index: i });
    }
  }

  // Sort by position to normalize comparison
  entries.sort((a, b) => a.position - b.position || a.preset.localeCompare(b.preset));
  return entries;
}

interface StandingEntry {
  preset: string;
  position: number;
  index: number;
}

/**
 * Compare two sets of standings for equality.
 */
function standingsMatch(a: StandingEntry[], b: StandingEntry[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i]!.position !== b[i]!.position || a[i]!.preset !== b[i]!.preset) {
      return false;
    }
  }

  return true;
}

/**
 * Build a human-readable description of where standings diverged.
 */
function buildDivergenceDetails(
  baseline: StandingEntry[],
  current: StandingEntry[],
  run: number,
): string {
  const lines: string[] = [`Divergence detected at run ${run}:`];
  lines.push(`  Baseline entries: ${baseline.length}, Current entries: ${current.length}`);

  const maxLen = Math.min(baseline.length, current.length, 5);
  for (let i = 0; i < maxLen; i++) {
    const b = baseline[i]!;
    const c = current[i]!;
    if (b.position !== c.position || b.preset !== c.preset) {
      lines.push(`  Position ${i + 1}: baseline=[${b.preset}@${b.position}] current=[${c.preset}@${c.position}]`);
    }
  }

  return lines.join('\n');
}
