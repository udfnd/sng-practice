import type { AIProfile, PresetType } from '@/types';

/**
 * The 6 AI presets with all parameters.
 * All ratios stored as 0.0–1.0. UI displays as percentage.
 */
export const PRESETS: Record<PresetType, AIProfile> = {
  Nit: {
    presetType: 'Nit',
    vpip: 0.10, pfr: 0.07, threeBetFreq: 0.03, foldTo3Bet: 0.75,
    fourBetRatio: 0.12, openRaiseSize: 2.5, openLimpFreq: 0.01,
    positionAwareness: 0.6, cBetFreq: 0.55, cBetSize: 0.50,
    turnBarrel: 0.40, riverBarrel: 0.25, foldToCBet: 0.60,
    checkRaiseFreq: 0.03, bluffFreq: 0.05,
    donkBetFreq: 0, overbetFreq: 0, riverPolarization: 0.3,
    icmAwareness: 0.5, pushFoldAccuracy: 0.7, stackSizeAdjust: 0.5,
    bubbleTightness: 0.8, bbDefenseBase: 0.15,
  },
  TAG: {
    presetType: 'TAG',
    vpip: 0.19, pfr: 0.16, threeBetFreq: 0.07, foldTo3Bet: 0.60,
    fourBetRatio: 0.15, openRaiseSize: 2.5, openLimpFreq: 0.0,
    positionAwareness: 0.8, cBetFreq: 0.70, cBetSize: 0.67,
    turnBarrel: 0.55, riverBarrel: 0.40, foldToCBet: 0.45,
    checkRaiseFreq: 0.06, bluffFreq: 0.15,
    donkBetFreq: 0.05, overbetFreq: 0, riverPolarization: 0.5,
    icmAwareness: 0.7, pushFoldAccuracy: 0.85, stackSizeAdjust: 0.7,
    bubbleTightness: 0.6, bbDefenseBase: 0.22,
  },
  LAG: {
    presetType: 'LAG',
    vpip: 0.30, pfr: 0.24, threeBetFreq: 0.12, foldTo3Bet: 0.45,
    fourBetRatio: 0.20, openRaiseSize: 2.5, openLimpFreq: 0.02,
    positionAwareness: 0.85, cBetFreq: 0.75, cBetSize: 0.75,
    turnBarrel: 0.60, riverBarrel: 0.45, foldToCBet: 0.35,
    checkRaiseFreq: 0.10, bluffFreq: 0.30,
    donkBetFreq: 0.08, overbetFreq: 0.05, riverPolarization: 0.7,
    icmAwareness: 0.6, pushFoldAccuracy: 0.80, stackSizeAdjust: 0.8,
    bubbleTightness: 0.4, bbDefenseBase: 0.35,
  },
  Station: {
    presetType: 'Station',
    vpip: 0.45, pfr: 0.08, threeBetFreq: 0.02, foldTo3Bet: 0.80,
    fourBetRatio: 0.10, openRaiseSize: 3.0, openLimpFreq: 0.30,
    positionAwareness: 0.3, cBetFreq: 0.35, cBetSize: 0.50,
    turnBarrel: 0.25, riverBarrel: 0.15, foldToCBet: 0.25,
    checkRaiseFreq: 0.02, bluffFreq: 0.05,
    donkBetFreq: 0.1, overbetFreq: 0, riverPolarization: 0.2,
    icmAwareness: 0.3, pushFoldAccuracy: 0.50, stackSizeAdjust: 0.3,
    bubbleTightness: 0.3, bbDefenseBase: 0.45,
  },
  Maniac: {
    presetType: 'Maniac',
    vpip: 0.55, pfr: 0.40, threeBetFreq: 0.18, foldTo3Bet: 0.30,
    fourBetRatio: 0.25, openRaiseSize: 3.0, openLimpFreq: 0.05,
    positionAwareness: 0.4, cBetFreq: 0.85, cBetSize: 0.80,
    turnBarrel: 0.70, riverBarrel: 0.55, foldToCBet: 0.20,
    checkRaiseFreq: 0.15, bluffFreq: 0.45,
    donkBetFreq: 0.15, overbetFreq: 0.15, riverPolarization: 0.8,
    icmAwareness: 0.2, pushFoldAccuracy: 0.60, stackSizeAdjust: 0.4,
    bubbleTightness: 0.2, bbDefenseBase: 0.50,
  },
  Shark: {
    presetType: 'Shark',
    vpip: 0.23, pfr: 0.19, threeBetFreq: 0.09, foldTo3Bet: 0.55,
    fourBetRatio: 0.18, openRaiseSize: 2.3, openLimpFreq: 0.0,
    positionAwareness: 0.95, cBetFreq: 0.68, cBetSize: 0.60,
    turnBarrel: 0.52, riverBarrel: 0.38, foldToCBet: 0.42,
    checkRaiseFreq: 0.08, bluffFreq: 0.22,
    donkBetFreq: 0.07, overbetFreq: 0.03, riverPolarization: 0.6,
    icmAwareness: 0.9, pushFoldAccuracy: 0.95, stackSizeAdjust: 0.9,
    bubbleTightness: 0.7, bbDefenseBase: 0.28,
  },
};

/**
 * Per-preset ring-game calibration scale factors.
 *
 * In an 8-player SNG, two systematic effects reduce measured VPIP/PFR/3-bet below the
 * preset target values:
 *   1. applyPositionAwareness compresses EP percentiles toward the baseline, causing tight
 *      presets with high positionAwareness to play tighter than their raw cutoffs imply.
 *   2. push/fold mode (≤ 10BB) uses Nash-based ranges that are often tighter than the preset
 *      VPIP target for TAG/Shark-style presets (which have high pushFoldAccuracy → Nash-tight).
 *
 * These multipliers are applied to VPIP/PFR cutoffs in ring-game situations (Sit A–E) to
 * recover the intended target statistics measured over a full SNG lifecycle.
 *
 * Calibration methodology: 100-SNG runs with masterSeed 'tune-v2'.
 *   vpip: multiplier for call/limp cutoffs (SitA limp, SitB call, SitC call, SitE defense)
 *   pfr:  multiplier for raise cutoffs in SitA/SitB (separate from vpip because Station
 *          has very low pfr=0.08 which must not be over-scaled by the high vpip multiplier)
 *   threeBet: multiplier for threeBetFreq cutoffs in SitC/SitE (separate; 3-bet stat has
 *             different dilution dynamics than VPIP)
 */
export const RING_GAME_SCALE: Record<string, { vpip: number; pfr: number; threeBet: number }> = {
  Nit:     { vpip: 3.43, pfr: 3.66, threeBet: 3.02 },
  TAG:     { vpip: 2.47, pfr: 3.65, threeBet: 2.39 },
  LAG:     { vpip: 1.99, pfr: 2.87, threeBet: 1.97 },
  Station: { vpip: 2.89, pfr: 0.67, threeBet: 0.91 },
  Maniac:  { vpip: 1.73, pfr: 2.04, threeBet: 1.62 },
  Shark:   { vpip: 2.94, pfr: 3.74, threeBet: 2.92 },
};

/**
 * Constraint validation errors.
 */
export interface ConstraintError {
  field: string;
  message: string;
}

/**
 * Validate AIProfile constraints.
 * Returns array of errors (empty = valid).
 */
export function validateConstraints(profile: AIProfile): ConstraintError[] {
  const errors: ConstraintError[] = [];

  // PFR ≤ VPIP
  if (profile.pfr > profile.vpip) {
    errors.push({ field: 'pfr', message: `PFR (${profile.pfr}) must be ≤ VPIP (${profile.vpip})` });
  }

  // openLimpFreq + PFR ≤ VPIP
  if (profile.openLimpFreq + profile.pfr > profile.vpip + 0.001) {
    errors.push({
      field: 'openLimpFreq',
      message: `openLimpFreq (${profile.openLimpFreq}) + PFR (${profile.pfr}) must be ≤ VPIP (${profile.vpip})`,
    });
  }

  // CBet ≥ Turn ≥ River
  if (profile.turnBarrel > profile.cBetFreq + 0.001) {
    errors.push({ field: 'turnBarrel', message: 'turnBarrel must be ≤ cBetFreq' });
  }
  if (profile.riverBarrel > profile.turnBarrel + 0.001) {
    errors.push({ field: 'riverBarrel', message: 'riverBarrel must be ≤ turnBarrel' });
  }

  // Range checks
  const rangeChecks: [string, number, number, number][] = [
    ['vpip', profile.vpip, 0, 1],
    ['pfr', profile.pfr, 0, 1],
    ['threeBetFreq', profile.threeBetFreq, 0, 1],
    ['foldTo3Bet', profile.foldTo3Bet, 0, 1],
    ['fourBetRatio', profile.fourBetRatio, 0.05, 0.35],
    ['openRaiseSize', profile.openRaiseSize, 2.0, 4.0],
    ['openLimpFreq', profile.openLimpFreq, 0, 1],
    ['positionAwareness', profile.positionAwareness, 0, 1],
    ['cBetFreq', profile.cBetFreq, 0, 1],
    ['cBetSize', profile.cBetSize, 0.20, 1.0],
    ['bluffFreq', profile.bluffFreq, 0, 1],
    ['bbDefenseBase', profile.bbDefenseBase, 0.10, 0.55],
  ];

  for (const [field, value, min, max] of rangeChecks) {
    if (value < min || value > max) {
      errors.push({ field, message: `${field} (${value}) must be in [${min}, ${max}]` });
    }
  }

  return errors;
}

/**
 * Get a preset by name. Returns a deep copy.
 */
export function getPreset(type: PresetType): AIProfile {
  return { ...PRESETS[type] };
}

/**
 * Create a fine-tuned profile from a preset base with overrides.
 * Validates constraints after applying overrides.
 */
export function createFineTunedProfile(
  base: PresetType,
  overrides: Partial<Omit<AIProfile, 'presetType'>>,
): { profile: AIProfile; errors: ConstraintError[] } {
  const profile: AIProfile = { ...PRESETS[base], ...overrides, presetType: base };
  const errors = validateConstraints(profile);
  return { profile, errors };
}
