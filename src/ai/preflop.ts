import type { AIProfile, ActionType } from '@/types';
import type { PositionGroup } from './position';
import { getHandPercentile, getHandBaselinePercentile } from './hand-ranges';

/**
 * Preflop decision result.
 */
export interface PreflopDecision {
  action: ActionType;
  amount: number;
  situation: PreflopSituation;
}

export type PreflopSituation =
  | 'UNOPENED'
  | 'LIMPED'
  | 'FACING_RAISE'
  | 'FACING_3BET'
  | 'BB_DEFENSE';

/**
 * Context for preflop decision-making.
 */
export interface PreflopContext {
  /** The AI player's profile */
  profile: AIProfile;
  /** High card rank (2-14) of hole cards */
  highRank: number;
  /** Low card rank (2-14) of hole cards */
  lowRank: number;
  /** Whether hole cards are suited */
  suited: boolean;
  /** Position group */
  position: PositionGroup;
  /** Current bet to face */
  facingBet: number;
  /** The BB amount */
  bb: number;
  /** Player's current bet already posted */
  currentBet: number;
  /** Player's remaining chips */
  chips: number;
  /** Whether pot is unopened */
  isUnopened: boolean;
  /** Number of limpers */
  limperCount: number;
  /** Whether facing the first raise (for Situation C/E) */
  facingFirstRaise: boolean;
  /** Whether this player opened and is now facing a 3-bet */
  facingThreeBet: boolean;
  /** Whether player is BB */
  isBB: boolean;
  /** Number of active players */
  activePlayers: number;
  /** Effective stack in BB */
  effectiveStackBB: number;
}

/**
 * Make a preflop decision using the 5-situation state machine.
 */
// @MX:WARN @MX:REASON="5-situation state machine with injectable rng for bluff decisions" | Main preflop routing — situation A-E
export function makePreflopDecision(ctx: PreflopContext, rng: () => number = Math.random): PreflopDecision {
  const rawPercentile = getHandPercentile(ctx.highRank, ctx.lowRank, ctx.suited, ctx.position);
  const baseline = getHandBaselinePercentile(ctx.highRank, ctx.lowRank, ctx.suited);
  const percentile = applyPositionAwareness(rawPercentile, ctx.position, ctx.profile.positionAwareness, baseline);

  // Push/fold mode: ≤ 10BB
  if (ctx.effectiveStackBB <= 10) {
    return pushFoldDecision(percentile, ctx, rng);
  }

  // Route to appropriate situation
  if (ctx.facingThreeBet) {
    return situationD(percentile, ctx, rng);
  }
  if (ctx.isBB && ctx.facingFirstRaise) {
    return situationE(percentile, ctx, rng);
  }
  if (ctx.facingFirstRaise) {
    return situationC(percentile, ctx, rng);
  }
  if (ctx.limperCount > 0 && ctx.facingBet <= ctx.bb) {
    return situationB(percentile, ctx, rng);
  }
  if (ctx.isUnopened) {
    return situationA(percentile, ctx, rng);
  }

  // BB option: pot is unopened but limperCount>0 was already handled above by situationB.
  // If BB has isUnopened=false and no raise was detected, BB can check for free.
  if (ctx.isBB && !ctx.facingFirstRaise && !ctx.facingThreeBet) {
    return { action: 'CHECK', amount: 0, situation: 'BB_DEFENSE' };
  }

  // Default: fold
  return { action: 'FOLD', amount: 0, situation: 'UNOPENED' };
}

/**
 * Situation A — Unopened Pot (no limpers, no raise)
 */
function situationA(percentile: number, ctx: PreflopContext, rng: () => number): PreflopDecision {
  const { profile, bb, chips, currentBet, isBB } = ctx;

  if (percentile <= profile.pfr) {
    // Open raise
    const rawSize = Math.round(profile.openRaiseSize * bb) + noise(bb, rng);
    const raiseSize = Math.max(2 * bb, rawSize);
    const amount = Math.min(raiseSize - currentBet, chips);
    return {
      action: currentBet > 0 ? 'RAISE' : 'BET',
      amount: amount >= chips ? chips : raiseSize,
      situation: 'UNOPENED',
    };
  }

  if (percentile <= profile.pfr + profile.openLimpFreq) {
    // Open limp
    const callAmount = Math.min(bb - currentBet, chips);
    return { action: 'CALL', amount: callAmount, situation: 'UNOPENED' };
  }

  // BB gets to check for free when pot is unopened and hand is outside raise/limp range
  if (isBB) {
    return { action: 'CHECK', amount: 0, situation: 'UNOPENED' };
  }

  return { action: 'FOLD', amount: 0, situation: 'UNOPENED' };
}

/**
 * Situation B — Limped Pot (limpers present, no raise)
 */
function situationB(percentile: number, ctx: PreflopContext, _rng: () => number): PreflopDecision {
  const { profile, bb, chips, currentBet, limperCount } = ctx;

  if (percentile <= profile.pfr) {
    // Iso-raise
    const rawSize = (profile.openRaiseSize + limperCount) * bb;
    const raiseSize = Math.max(2 * bb, rawSize);
    const amount = Math.min(raiseSize - currentBet, chips);
    return { action: 'RAISE', amount: amount >= chips ? chips : raiseSize, situation: 'LIMPED' };
  }

  if (percentile <= profile.vpip) {
    // Limp behind
    const callAmount = Math.min(bb - currentBet, chips);
    return { action: 'CALL', amount: callAmount, situation: 'LIMPED' };
  }

  return { action: 'FOLD', amount: 0, situation: 'LIMPED' };
}

/**
 * Situation C — Facing First Raise (non-BB)
 */
function situationC(percentile: number, ctx: PreflopContext, rng: () => number): PreflopDecision {
  const { profile, facingBet, chips, currentBet, bb } = ctx;
  const adjust = facingRaiseAdjust(facingBet, bb);

  const threeBetCutoff = clamp01(Math.min(
    profile.threeBetFreq * adjust,
    profile.vpip * adjust,
  ));
  const callingCutoff = clamp01(profile.vpip * adjust);

  if (percentile <= threeBetCutoff) {
    // 3-bet
    const size = computeThreeBetSize(facingBet, bb, ctx.position, chips, currentBet, rng);
    return { action: 'RAISE', amount: size, situation: 'FACING_RAISE' };
  }

  if (percentile <= callingCutoff) {
    // Call
    const callAmount = Math.min(facingBet - currentBet, chips);
    return { action: 'CALL', amount: callAmount, situation: 'FACING_RAISE' };
  }

  return { action: 'FOLD', amount: 0, situation: 'FACING_RAISE' };
}

/**
 * Situation D — Opener Facing 3-Bet
 */
function situationD(percentile: number, ctx: PreflopContext, rng: () => number): PreflopDecision {
  const { profile, facingBet, chips, currentBet, bb } = ctx;

  // Step 1: Check 4-bet range (top portion of open range)
  const fourBetCutoff = profile.pfr * profile.fourBetRatio;

  if (percentile <= fourBetCutoff) {
    // 4-bet (or jam if short)
    const size = compute4BetSize(facingBet, bb, chips, currentBet, rng);
    return { action: 'RAISE', amount: size, situation: 'FACING_3BET' };
  }

  // Step 2: For hands outside 4-bet range: fold or call
  const randVal = pseudoRandom(percentile);
  if (randVal < profile.foldTo3Bet) {
    return { action: 'FOLD', amount: 0, situation: 'FACING_3BET' };
  }

  const callAmount = Math.min(facingBet - currentBet, chips);
  return { action: 'CALL', amount: callAmount, situation: 'FACING_3BET' };
}

/**
 * Situation E — BB Defense
 */
function situationE(percentile: number, ctx: PreflopContext, rng: () => number): PreflopDecision {
  const { profile, facingBet, chips, currentBet, bb } = ctx;
  const adjust = facingRaiseAdjust(facingBet, bb);
  const BB_DEFENSE_BONUS = 1.3;

  const bbDefenseCutoff = clamp01(profile.bbDefenseBase * adjust * BB_DEFENSE_BONUS);
  const threeBetCutoff = clamp01(Math.min(
    profile.threeBetFreq * adjust,
    bbDefenseCutoff,
  ));

  if (percentile <= threeBetCutoff) {
    // 3-bet from BB
    const size = computeThreeBetSize(facingBet, bb, 'BB', chips, currentBet, rng);
    return { action: 'RAISE', amount: size, situation: 'BB_DEFENSE' };
  }

  if (percentile <= bbDefenseCutoff) {
    // Call (defend)
    const callAmount = Math.min(facingBet - currentBet, chips);
    return { action: 'CALL', amount: callAmount, situation: 'BB_DEFENSE' };
  }

  return { action: 'FOLD', amount: 0, situation: 'BB_DEFENSE' };
}

/**
 * Push/fold mode for ≤ 10BB stacks.
 */
function pushFoldDecision(percentile: number, ctx: PreflopContext, _rng: () => number): PreflopDecision {
  const { chips, currentBet } = ctx;
  // Push threshold based on effective stack (Nash-approximated ranges)
  // At 1BB: ~65%, at 3BB: ~45%, at 5BB: ~30%, at 8BB: ~18%, at 10BB: ~12%
  const pushThreshold = clamp01(ctx.effectiveStackBB <= 1
    ? 0.65
    : 0.65 - (ctx.effectiveStackBB - 1) * 0.06);

  if (percentile <= pushThreshold) {
    return { action: 'RAISE', amount: chips + currentBet, situation: 'UNOPENED' }; // All-in (raiseTo = total committed)
  }

  // If facing a bet above BB, tighter call range
  if (ctx.facingBet > ctx.bb) {
    const callThreshold = pushThreshold * 0.6;
    if (percentile <= callThreshold) {
      const callAmount = Math.min(ctx.facingBet - currentBet, chips);
      return { action: 'CALL', amount: callAmount, situation: 'FACING_RAISE' };
    }
    return { action: 'FOLD', amount: 0, situation: 'FACING_RAISE' };
  }

  // BB gets a free check in an unopened pot (no raise above BB).
  // This is a fundamental poker rule: BB always has the option to check
  // when no one has raised. Even in push/fold mode, this must be honored.
  if (ctx.isBB && !ctx.facingFirstRaise) {
    return { action: 'CHECK', amount: 0, situation: 'BB_DEFENSE' };
  }

  return { action: 'FOLD', amount: 0, situation: 'UNOPENED' };
}

// ========== Sizing Helpers ==========

function computeThreeBetSize(
  facingRaise: number,
  bb: number,
  position: PositionGroup,
  chips: number,
  currentBet: number,
  rng: () => number,
): number {
  const multiplier = (position === 'BTN' || position === 'CO') ? 3.0 : 3.5;
  const raw = Math.round(facingRaise * multiplier) + noise(bb, rng);
  const size = Math.max(facingRaise + bb, raw); // at least min-raise

  // Jam threshold: 15BB
  if ((chips + currentBet) <= 15 * bb) {
    return chips; // all-in
  }

  return Math.round(Math.min(size, chips));
}

function compute4BetSize(
  facing3Bet: number,
  bb: number,
  chips: number,
  currentBet: number,
  rng: () => number,
): number {
  const raw = Math.round(facing3Bet * 2.2) + noise(bb, rng);
  const size = Math.max(facing3Bet + bb, raw);

  // Jam threshold: 25BB
  if ((chips + currentBet) <= 25 * bb) {
    return chips; // all-in
  }

  return Math.round(Math.min(size, chips));
}

// ========== Utility ==========

function facingRaiseAdjust(facingBet: number, bb: number): number {
  // Range narrows as facing bet increases
  const raiseBBs = facingBet / bb;
  if (raiseBBs <= 2.5) return 0.8;
  if (raiseBBs <= 4) return 0.7;
  if (raiseBBs <= 8) return 0.6;
  return 0.5;
}

/**
 * Apply positionAwareness interpolation (Design Doc 6.4.4).
 *
 * effectivePercentile = baseline + positionAwareness × (positionTable - baseline)
 * baseline = average of ring 6 positions (EP,MP,CO,BTN,SB,BB). HU excluded.
 *
 * awareness = 1.0 → full position sensitivity (use position table exactly)
 * awareness = 0.0 → uniform play across all positions (use baseline)
 */
function applyPositionAwareness(
  positionPercentile: number,
  position: PositionGroup,
  awareness: number,
  baseline: number,
): number {
  if (position === 'HU') return positionPercentile; // HU: no interpolation

  return clamp01(baseline + awareness * (positionPercentile - baseline));
}

function noise(bb: number, rng: () => number): number {
  // ±0.5BB deterministic pseudo-noise (simplified), rounded to integer chips
  return Math.round((rng() - 0.5) * bb);
}

function pseudoRandom(seed: number): number {
  // Simple hash-like function for deterministic fold/call decision
  return ((seed * 1000) % 1) * (seed > 0.5 ? 1 : 0.8);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export { clamp01 };
