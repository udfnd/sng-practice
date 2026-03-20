import { describe, it, expect } from 'vitest';
import { getCalibrationTargets, checkCalibration, checkBalance, type BalanceResult } from '@/ai/calibration';
import type { PlayerStats } from '@/types';

describe('Calibration Targets', () => {
  it('should define targets for all 6 presets', () => {
    const targets = getCalibrationTargets();
    expect(targets).toHaveLength(6);
    expect(targets.map((t) => t.presetType)).toEqual(['Nit', 'TAG', 'LAG', 'Station', 'Maniac', 'Shark']);
  });

  it('should have ±2% tolerance', () => {
    const targets = getCalibrationTargets();
    for (const t of targets) {
      expect(t.tolerance).toBe(0.02);
    }
  });
});

describe('checkCalibration', () => {
  const tagTarget = getCalibrationTargets().find((t) => t.presetType === 'TAG')!;

  it('should pass when stats are within tolerance', () => {
    const stats: PlayerStats = {
      handsEligible: 10000,
      vpipCount: 1900, // 19% = target
      pfrCount: 1600,  // 16% = target
      threeBetOpportunities: 2000,
      threeBetCount: 140, // 7% = target
      cBetOpportunities: 0,
      cBetCount: 0,
      wentToShowdown: 0,
      wonAtShowdown: 0,
    };

    const result = checkCalibration(stats, tagTarget);
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail when VPIP is out of range', () => {
    const stats: PlayerStats = {
      handsEligible: 10000,
      vpipCount: 2500, // 25% — outside 19% ±2%
      pfrCount: 1600,
      threeBetOpportunities: 2000,
      threeBetCount: 140,
      cBetOpportunities: 0,
      cBetCount: 0,
      wentToShowdown: 0,
      wonAtShowdown: 0,
    };

    const result = checkCalibration(stats, tagTarget);
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('VPIP'))).toBe(true);
  });

  it('should handle zero hands gracefully', () => {
    const stats: PlayerStats = {
      handsEligible: 0,
      vpipCount: 0,
      pfrCount: 0,
      threeBetOpportunities: 0,
      threeBetCount: 0,
      cBetOpportunities: 0,
      cBetCount: 0,
      wentToShowdown: 0,
      wonAtShowdown: 0,
    };

    const result = checkCalibration(stats, tagTarget);
    // 0 != target, so should fail
    expect(result.vpipActual).toBe(0);
  });
});

describe('checkBalance', () => {
  it('should warn when 1st place rate is outside 2-40%', () => {
    const results: BalanceResult[] = [
      { presetType: 'Nit', firstPlaceRate: 0.01, averagePosition: 5.5, totalGames: 1000 },
    ];
    const warnings = checkBalance(results);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should warn when Shark ranks worse than Nit', () => {
    const results: BalanceResult[] = [
      { presetType: 'Shark', firstPlaceRate: 0.10, averagePosition: 5.0, totalGames: 1000 },
      { presetType: 'Nit', firstPlaceRate: 0.10, averagePosition: 4.0, totalGames: 1000 },
    ];
    const warnings = checkBalance(results);
    expect(warnings.some((w) => w.includes('Shark'))).toBe(true);
  });

  it('should pass with reasonable results', () => {
    const results: BalanceResult[] = [
      { presetType: 'Shark', firstPlaceRate: 0.18, averagePosition: 3.5, totalGames: 1000 },
      { presetType: 'TAG', firstPlaceRate: 0.15, averagePosition: 3.8, totalGames: 1000 },
      { presetType: 'Nit', firstPlaceRate: 0.10, averagePosition: 4.5, totalGames: 1000 },
    ];
    const warnings = checkBalance(results);
    expect(warnings).toHaveLength(0);
  });
});
