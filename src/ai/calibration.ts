import type { PlayerStats, PresetType } from '@/types';
import { PRESETS } from './presets';

/**
 * Calibration target for a preset.
 * Defines expected stat ranges after N simulated hands.
 */
export interface CalibrationTarget {
  presetType: PresetType;
  vpipTarget: number;
  pfrTarget: number;
  threeBetTarget: number;
  tolerance: number; // ±tolerance
}

/**
 * Get calibration targets for all presets.
 * VPIP/PFR use handsEligible denominator ±2%.
 * 3-Bet uses threeBetOpportunities denominator ±2%.
 */
export function getCalibrationTargets(): CalibrationTarget[] {
  return Object.values(PRESETS).map((p) => ({
    presetType: p.presetType,
    vpipTarget: p.vpip,
    pfrTarget: p.pfr,
    threeBetTarget: p.threeBetFreq,
    tolerance: 0.02,
  }));
}

/**
 * Check if observed stats match calibration targets.
 */
export function checkCalibration(
  stats: PlayerStats,
  target: CalibrationTarget,
): { pass: boolean; vpipActual: number; pfrActual: number; threeBetActual: number; errors: string[] } {
  const errors: string[] = [];

  const vpipActual = stats.handsEligible > 0 ? stats.vpipCount / stats.handsEligible : 0;
  const pfrActual = stats.handsEligible > 0 ? stats.pfrCount / stats.handsEligible : 0;
  const threeBetActual = stats.threeBetOpportunities > 0 ? stats.threeBetCount / stats.threeBetOpportunities : 0;

  if (Math.abs(vpipActual - target.vpipTarget) > target.tolerance) {
    errors.push(`VPIP: ${(vpipActual * 100).toFixed(1)}% (target: ${(target.vpipTarget * 100).toFixed(1)}% ±${(target.tolerance * 100).toFixed(0)}%)`);
  }

  if (Math.abs(pfrActual - target.pfrTarget) > target.tolerance) {
    errors.push(`PFR: ${(pfrActual * 100).toFixed(1)}% (target: ${(target.pfrTarget * 100).toFixed(1)}% ±${(target.tolerance * 100).toFixed(0)}%)`);
  }

  if (Math.abs(threeBetActual - target.threeBetTarget) > target.tolerance) {
    errors.push(`3-Bet: ${(threeBetActual * 100).toFixed(1)}% (target: ${(target.threeBetTarget * 100).toFixed(1)}% ±${(target.tolerance * 100).toFixed(0)}%)`);
  }

  return {
    pass: errors.length === 0,
    vpipActual,
    pfrActual,
    threeBetActual,
    errors,
  };
}

/**
 * Balance validation result.
 */
export interface BalanceResult {
  presetType: PresetType;
  firstPlaceRate: number;
  averagePosition: number;
  totalGames: number;
}

/**
 * Check balance soft assertions (95% CI).
 * Returns warnings, not failures.
 */
export function checkBalance(results: BalanceResult[]): string[] {
  const warnings: string[] = [];

  for (const r of results) {
    if (r.firstPlaceRate < 0.02 || r.firstPlaceRate > 0.40) {
      warnings.push(`${r.presetType}: 1st place rate ${(r.firstPlaceRate * 100).toFixed(1)}% outside 2-40% range`);
    }
  }

  // Shark/TAG should average better than Nit/Station
  const shark = results.find((r) => r.presetType === 'Shark');
  const nit = results.find((r) => r.presetType === 'Nit');
  if (shark && nit && shark.averagePosition > nit.averagePosition) {
    warnings.push(`Shark avg position (${shark.averagePosition.toFixed(1)}) worse than Nit (${nit.averagePosition.toFixed(1)})`);
  }

  return warnings;
}
