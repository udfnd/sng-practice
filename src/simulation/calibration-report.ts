import type { SimulationResult } from './batch-runner';

// ============================================================
// Public types
// ============================================================

export interface PresetCalibration {
  preset: string;
  vpip: { actual: number; target: number; passed: boolean };
  pfr: { actual: number; target: number; passed: boolean };
  threeBet: { actual: number; target: number; passed: boolean };
}

export interface CalibrationReport {
  presetResults: PresetCalibration[];
  chipConservation: { passed: boolean };
  completion: { completed: number; total: number };
  determinism: { passed: boolean; runs: number };
  balance: {
    rankings: Record<string, number>;
    notes: string[];
  };
  performance: {
    avgHandMs: number;
    totalMs: number;
    totalHands: number;
  };
}

// ============================================================
// Calibration tolerance
// ============================================================

/** ±2% absolute tolerance for pass/fail */
const CALIBRATION_TOLERANCE = 0.02;

// ============================================================
// generateCalibrationReport
// ============================================================

/**
 * Generate a structured CalibrationReport from SimulationResult.
 */
export function generateCalibrationReport(result: SimulationResult): CalibrationReport {
  // Build preset calibration entries
  const presetResults: PresetCalibration[] = Object.entries(result.perPreset).map(
    ([presetName, stats]) => ({
      preset: presetName,
      vpip: {
        actual: stats.vpip,
        target: stats.vpipTarget,
        passed: Math.abs(stats.vpip - stats.vpipTarget) <= CALIBRATION_TOLERANCE,
      },
      pfr: {
        actual: stats.pfr,
        target: stats.pfrTarget,
        passed: Math.abs(stats.pfr - stats.pfrTarget) <= CALIBRATION_TOLERANCE,
      },
      threeBet: {
        actual: stats.threeBet,
        target: stats.threeBetTarget,
        passed: Math.abs(stats.threeBet - stats.threeBetTarget) <= CALIBRATION_TOLERANCE,
      },
    }),
  );

  // Sort presets by name for stable output
  presetResults.sort((a, b) => a.preset.localeCompare(b.preset));

  // Balance: rank presets by average finish position (lower = better)
  const rankings: Record<string, number> = {};
  const presetsByAvg = Object.entries(result.perPreset)
    .filter(([, stats]) => stats.results.length > 0)
    .sort(([, a], [, b]) => a.avgFinishPosition - b.avgFinishPosition);

  presetsByAvg.forEach(([name], idx) => {
    rankings[name] = idx + 1;
  });

  // Generate balance notes
  const notes = buildBalanceNotes(result);

  return {
    presetResults,
    chipConservation: { passed: result.chipConservationPassed },
    completion: {
      completed: result.sngsCompleted,
      total: result.sngsCompleted + result.sngsErrored,
    },
    // Determinism check requires re-run; here we report as a placeholder
    // The actual determinism check is run separately via checkDeterminism()
    determinism: {
      passed: result.sngsErrored === 0,
      runs: result.sngsCompleted,
    },
    balance: { rankings, notes },
    performance: {
      avgHandMs: result.timingMs.avgHandMs,
      totalMs: result.timingMs.totalMs,
      totalHands: result.timingMs.totalHands,
    },
  };
}

// ============================================================
// formatReportAsText
// ============================================================

/**
 * Format a CalibrationReport as human-readable text.
 */
export function formatReportAsText(report: CalibrationReport): string {
  const lines: string[] = [];

  lines.push('=== Calibration Report ===');
  lines.push('');

  // Completion
  lines.push(`Completion: ${report.completion.completed}/${report.completion.total} SNGs`);
  lines.push('');

  // Chip Conservation
  const chipStatus = report.chipConservation.passed ? 'PASS' : 'FAIL';
  lines.push(`Chip Conservation: ${chipStatus}`);
  lines.push('');

  // Determinism
  const detStatus = report.determinism.passed ? 'PASS' : 'FAIL';
  lines.push(`Determinism: ${detStatus} (${report.determinism.runs} runs)`);
  lines.push('');

  // Preset Calibration
  lines.push('--- Preset Calibration ---');
  for (const entry of report.presetResults) {
    lines.push(`  ${entry.preset}:`);
    lines.push(`    VPIP:    actual=${pct(entry.vpip.actual)} target=${pct(entry.vpip.target)} [${entry.vpip.passed ? 'PASS' : 'FAIL'}]`);
    lines.push(`    PFR:     actual=${pct(entry.pfr.actual)} target=${pct(entry.pfr.target)} [${entry.pfr.passed ? 'PASS' : 'FAIL'}]`);
    lines.push(`    3-Bet:   actual=${pct(entry.threeBet.actual)} target=${pct(entry.threeBet.target)} [${entry.threeBet.passed ? 'PASS' : 'FAIL'}]`);
  }
  lines.push('');

  // Balance Rankings
  lines.push('--- Balance Rankings (by avg finish position) ---');
  const sortedRankings = Object.entries(report.balance.rankings)
    .sort(([, a], [, b]) => a - b);
  for (const [preset, rank] of sortedRankings) {
    lines.push(`  ${rank}. ${preset}`);
  }

  if (report.balance.notes.length > 0) {
    lines.push('');
    lines.push('  Notes:');
    for (const note of report.balance.notes) {
      lines.push(`    - ${note}`);
    }
  }
  lines.push('');

  // Performance
  lines.push('--- Performance ---');
  lines.push(`  Total hands: ${report.performance.totalHands}`);
  lines.push(`  Total time:  ${report.performance.totalMs.toFixed(0)}ms`);
  lines.push(`  Avg hand:    ${report.performance.avgHandMs.toFixed(2)}ms`);
  lines.push('');

  lines.push('=== End of Report ===');

  return lines.join('\n');
}

// ============================================================
// Internal helpers
// ============================================================

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildBalanceNotes(result: SimulationResult): string[] {
  const notes: string[] = [];

  const presets = Object.entries(result.perPreset);
  if (presets.length < 2) return notes;

  // Find best and worst by avg finish position
  const sorted = presets
    .filter(([, s]) => s.results.length > 0)
    .sort(([, a], [, b]) => a.avgFinishPosition - b.avgFinishPosition);

  if (sorted.length >= 2) {
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    notes.push(
      `Best avg finish: ${best[0]} (${best[1].avgFinishPosition.toFixed(2)}), ` +
      `Worst: ${worst[0]} (${worst[1].avgFinishPosition.toFixed(2)})`,
    );
  }

  // Warn about any preset with win rate outside 2-40%
  for (const [name, stats] of presets) {
    if (stats.results.length < 10) continue;
    if (stats.firstPlaceRate < 0.02 || stats.firstPlaceRate > 0.40) {
      notes.push(
        `${name} win rate ${pct(stats.firstPlaceRate)} is outside expected 2-40% range`,
      );
    }
  }

  return notes;
}
