import type { PositionGroup } from './position';

export type { PositionGroup };

/**
 * Stack depth breakpoints (in BB) for the Nash push range table.
 * Values between breakpoints are linearly interpolated.
 */
const STACK_BREAKPOINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15] as const;

/**
 * Nash push range table: percentile threshold per position per stack depth.
 * push when hand percentile <= threshold.
 *
 * Based on Jennings-style Nash equilibrium approximations.
 * Rows correspond to STACK_BREAKPOINTS, columns to positions.
 */
const PUSH_TABLE: Record<PositionGroup, readonly number[]> = {
  // @MX:ANCHOR Nash push range table — static lookup, no runtime computation
  BTN: [1.00, 0.80, 0.60, 0.50, 0.42, 0.36, 0.30, 0.25, 0.22, 0.18, 0.14, 0.10],
  CO:  [1.00, 0.65, 0.45, 0.38, 0.32, 0.27, 0.22, 0.18, 0.16, 0.13, 0.10, 0.07],
  MP:  [0.80, 0.50, 0.35, 0.28, 0.22, 0.18, 0.15, 0.12, 0.10, 0.08, 0.06, 0.04],
  EP:  [0.70, 0.40, 0.25, 0.20, 0.16, 0.13, 0.10, 0.08, 0.07, 0.06, 0.04, 0.03],
  SB:  [1.00, 0.85, 0.70, 0.55, 0.48, 0.40, 0.35, 0.30, 0.25, 0.22, 0.16, 0.12],
  // BB is not a push position (BB calls, not pushes), use EP-like values as fallback
  BB:  [0.70, 0.40, 0.25, 0.20, 0.16, 0.13, 0.10, 0.08, 0.07, 0.06, 0.04, 0.03],
  // HU (heads-up): push very wide
  HU:  [1.00, 1.00, 0.90, 0.80, 0.70, 0.60, 0.50, 0.42, 0.36, 0.30, 0.22, 0.16],
};

/**
 * Multiplier applied per additional player yet to act after the pusher.
 * Range shrinks ~15% per extra opponent.
 */
const PLAYERS_TO_ACT_MULTIPLIER = 0.85;

/**
 * Ante presence widens push range by ~15% (more dead money in the pot).
 */
const ANTE_MULTIPLIER = 1.15;

/**
 * Linear interpolation between two values.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value to [0, 1].
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Look up the base push range for a given stack depth and position using
 * linear interpolation between table breakpoints.
 */
function interpolatePushRange(effectiveStackBB: number, position: PositionGroup): number {
  const tableRow = PUSH_TABLE[position];

  // Below the lowest breakpoint: return the value at the lowest breakpoint
  if (effectiveStackBB <= STACK_BREAKPOINTS[0]) {
    return tableRow[0]!;
  }

  // Above the highest breakpoint: extrapolate downward (range continues shrinking)
  const lastIdx = STACK_BREAKPOINTS.length - 1;
  if (effectiveStackBB >= STACK_BREAKPOINTS[lastIdx]!) {
    // Extrapolate: each BB above 15BB, apply an additional reduction factor
    const extraBB = effectiveStackBB - STACK_BREAKPOINTS[lastIdx]!;
    const lastValue = tableRow[lastIdx]!;
    // Decay rate derived from the slope at the end of the table
    const prevValue = tableRow[lastIdx - 1]!;
    const prevStack = STACK_BREAKPOINTS[lastIdx - 1]!;
    const currentStack = STACK_BREAKPOINTS[lastIdx]!;
    const slopePerBB = (lastValue - prevValue) / (currentStack - prevStack);
    return clamp01(lastValue + slopePerBB * extraBB);
  }

  // Find the surrounding breakpoints and interpolate
  for (let i = 0; i < lastIdx; i++) {
    const lo = STACK_BREAKPOINTS[i]!;
    const hi = STACK_BREAKPOINTS[i + 1]!;
    if (effectiveStackBB >= lo && effectiveStackBB <= hi) {
      const t = (effectiveStackBB - lo) / (hi - lo);
      return lerp(tableRow[i]!, tableRow[i + 1]!, t);
    }
  }

  // Should not reach here
  return tableRow[0]!;
}

/**
 * Get Nash push range (percentile threshold) for given tournament context.
 *
 * Returns the percentile threshold: push when hand percentile <= threshold.
 * A value of 0.25 means "push the top 25% of hands".
 *
 * @param effectiveStackBB - Effective stack in big blinds
 * @param position - Position group of the pusher
 * @param playersToAct - Number of players still to act after this player (0 = last to act)
 * @param hasAnte - Whether antes are present in this blind level
 */
export function getNashPushRange(
  effectiveStackBB: number,
  position: PositionGroup,
  playersToAct: number,
  hasAnte: boolean,
): number {
  // Base range from table lookup with interpolation
  let range = interpolatePushRange(effectiveStackBB, position);

  // Players-to-act adjustment: each additional player reduces range by ~15%
  if (playersToAct > 0) {
    range = range * Math.pow(PLAYERS_TO_ACT_MULTIPLIER, playersToAct);
  }

  // Ante adjustment: more dead money = wider push range
  if (hasAnte) {
    range = range * ANTE_MULTIPLIER;
  }

  return clamp01(range);
}

/**
 * Get Nash call range (percentile threshold) for calling an all-in push.
 *
 * Returns the percentile threshold: call when hand percentile <= threshold.
 * Call ranges are always tighter than push ranges at the same stack depth.
 *
 * Based on pot odds:
 * - Better pot odds (e.g., 3:1) → wider call range
 * - Worse pot odds (e.g., 1:1) → tighter call range
 *
 * @param effectiveStackBB - Effective stack in big blinds (remaining stack to call)
 * @param pushSizeBB - Size of the push in big blinds
 * @param potOdds - Ratio of total pot to the amount needed to call (pot / call)
 */
export function getNashCallRange(
  effectiveStackBB: number,
  pushSizeBB: number,
  potOdds: number,
): number {
  // Use EP (tightest position) as the base call range reference
  const basePushRange = interpolatePushRange(effectiveStackBB, 'EP');

  // Pot odds factor: scale by how good the odds are
  // At 2:1 odds → factor 0.7, at 1.5:1 → 0.6, at 1:1 → 0.5
  // Linear interpolation: potOdds of 1.0 → 0.5, potOdds of 3.0 → 0.8
  const potOddsFactor = clamp01(0.5 + (potOdds - 1.0) * 0.15);

  // Call range = push_range * base_call_fraction * pot_odds_factor
  // Base call fraction: 0.5 (call range is roughly half the push range at equal odds)
  const callRange = basePushRange * 0.5 * (potOddsFactor / 0.65);

  return clamp01(callRange);
}
