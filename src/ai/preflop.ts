import type { AIProfile, ActionType } from '@/types';
import type { PositionGroup } from './position';
import { getHandPercentile } from './hand-ranges';

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
export function makePreflopDecision(ctx: PreflopContext): PreflopDecision {
  const rawPercentile = getHandPercentile(ctx.highRank, ctx.lowRank, ctx.suited, ctx.position);
  const percentile = applyPositionAwareness(rawPercentile, ctx.position, ctx.profile.positionAwareness);

  // Push/fold mode: ≤ 10BB
  if (ctx.effectiveStackBB <= 10) {
    return pushFoldDecision(percentile, ctx);
  }

  // Route to appropriate situation
  if (ctx.facingThreeBet) {
    return situationD(percentile, ctx);
  }
  if (ctx.isBB && ctx.facingFirstRaise) {
    return situationE(percentile, ctx);
  }
  if (ctx.facingFirstRaise) {
    return situationC(percentile, ctx);
  }
  if (ctx.limperCount > 0 && ctx.facingBet <= ctx.bb) {
    return situationB(percentile, ctx);
  }
  if (ctx.isUnopened) {
    return situationA(percentile, ctx);
  }

  // Default: fold
  return { action: 'FOLD', amount: 0, situation: 'UNOPENED' };
}

/**
 * Situation A — Unopened Pot (no limpers, no raise)
 */
function situationA(percentile: number, ctx: PreflopContext): PreflopDecision {
  const { profile, bb, chips, currentBet } = ctx;

  if (percentile <= profile.pfr) {
    // Open raise
    const rawSize = profile.openRaiseSize * bb + noise(bb);
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

  return { action: 'FOLD', amount: 0, situation: 'UNOPENED' };
}

/**
 * Situation B — Limped Pot (limpers present, no raise)
 */
function situationB(percentile: number, ctx: PreflopContext): PreflopDecision {
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
function situationC(percentile: number, ctx: PreflopContext): PreflopDecision {
  const { profile, facingBet, chips, currentBet, bb } = ctx;
  const adjust = facingRaiseAdjust(facingBet, bb);

  const threeBetCutoff = clamp01(Math.min(
    profile.threeBetFreq * adjust,
    profile.vpip * adjust,
  ));
  const callingCutoff = clamp01(profile.vpip * adjust);

  if (percentile <= threeBetCutoff) {
    // 3-bet
    const size = computeThreeBetSize(facingBet, bb, ctx.position, chips, currentBet);
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
function situationD(percentile: number, ctx: PreflopContext): PreflopDecision {
  const { profile, facingBet, chips, currentBet, bb } = ctx;

  // Step 1: Check 4-bet range (top portion of open range)
  const fourBetCutoff = profile.pfr * profile.fourBetRatio;

  if (percentile <= fourBetCutoff) {
    // 4-bet (or jam if short)
    const size = compute4BetSize(facingBet, bb, chips, currentBet);
    return { action: 'RAISE', amount: size, situation: 'FACING_3BET' };
  }

  // Step 2: For hands outside 4-bet range: fold or call
  const rng = pseudoRandom(percentile);
  if (rng < profile.foldTo3Bet) {
    return { action: 'FOLD', amount: 0, situation: 'FACING_3BET' };
  }

  const callAmount = Math.min(facingBet - currentBet, chips);
  return { action: 'CALL', amount: callAmount, situation: 'FACING_3BET' };
}

/**
 * Situation E — BB Defense
 */
function situationE(percentile: number, ctx: PreflopContext): PreflopDecision {
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
    const size = computeThreeBetSize(facingBet, bb, 'BB', chips, currentBet);
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
function pushFoldDecision(percentile: number, ctx: PreflopContext): PreflopDecision {
  const { chips, currentBet } = ctx;
  // Push threshold based on stack size (smaller stack = wider range)
  const pushThreshold = clamp01(0.05 + (10 - ctx.effectiveStackBB) * 0.03);

  if (percentile <= pushThreshold) {
    return { action: 'RAISE', amount: chips, situation: 'UNOPENED' }; // All-in
  }

  // If facing a bet, tighter call range
  if (ctx.facingBet > ctx.bb) {
    const callThreshold = pushThreshold * 0.6;
    if (percentile <= callThreshold) {
      const callAmount = Math.min(ctx.facingBet - currentBet, chips);
      return { action: 'CALL', amount: callAmount, situation: 'FACING_RAISE' };
    }
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
): number {
  const multiplier = (position === 'BTN' || position === 'CO') ? 3.0 : 3.5;
  const raw = facingRaise * multiplier + noise(bb);
  const size = Math.max(facingRaise + bb, raw); // at least min-raise

  // Jam threshold: 15BB
  if ((chips + currentBet) <= 15 * bb) {
    return chips; // all-in
  }

  return Math.min(size, chips);
}

function compute4BetSize(
  facing3Bet: number,
  bb: number,
  chips: number,
  currentBet: number,
): number {
  const raw = facing3Bet * 2.2 + noise(bb);
  const size = Math.max(facing3Bet + bb, raw);

  // Jam threshold: 25BB
  if ((chips + currentBet) <= 25 * bb) {
    return chips; // all-in
  }

  return Math.min(size, chips);
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
 * Apply positionAwareness interpolation.
 * effectivePercentile = baseline + positionAwareness × (positionTable - baseline)
 */
function applyPositionAwareness(
  positionPercentile: number,
  position: PositionGroup,
  awareness: number,
): number {
  if (position === 'HU') return positionPercentile; // HU: no interpolation

  // Baseline = average of ring positions (would need all 6 positions' percentiles)
  // Simplified: use the position percentile directly scaled by awareness
  // awareness = 1.0 → full table, 0.0 → uniform (use a wider baseline)
  const uniformFactor = 1.0 + (1.0 - awareness) * 0.3;
  return clamp01(positionPercentile * uniformFactor);
}

function noise(bb: number): number {
  // ±0.5BB deterministic pseudo-noise (simplified)
  return (Math.random() - 0.5) * bb;
}

function pseudoRandom(seed: number): number {
  // Simple hash-like function for deterministic fold/call decision
  return ((seed * 1000) % 1) * (seed > 0.5 ? 1 : 0.8);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export { clamp01 };
