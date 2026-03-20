import type { AIProfile, ActionType } from '@/types';
import type { PositionGroup } from './position';
import { getHandPercentile, getHandBaselinePercentile } from './hand-ranges';
import { computeBubbleFactor, icmAdjustedThreshold } from './icm';
import { getNashPushRange, getNashCallRange } from './nash-tables';

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
  /** ICM context (optional for backward compat) */
  allStacks?: number[];
  /** Payout amounts in descending order (optional) */
  payoutAmounts?: number[];
  /** Index of this player in allStacks array (optional) */
  playerStackIndex?: number;
  /** Whether antes are present in the current blind level (optional, default false) */
  hasAnte?: boolean;
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

  // callingCutoff: top vpip% of hands call or 3-bet when facing a raise.
  // threeBetCutoff: top threeBetFreq% of all hands is a 3-bet (raw percentile threshold).
  // The raw threshold is higher than the target 3-bet% because push/fold mode adds many
  // facing-raise opportunities to the denominator without generating 3-bets, diluting
  // the measured stat. The preset threeBetFreq accounts for this dilution effect.
  let callingCutoff = clamp01(profile.vpip * adjust);
  let threeBetCutoff = clamp01(Math.min(
    profile.threeBetFreq * adjust,
    callingCutoff,
  ));

  // ICM tightening in SitC: if bubble factor > 1.2, reduce calling/3-bet cutoffs
  const bubbleFactor = getICMBubbleFactor(ctx);
  if (bubbleFactor > 1.2) {
    const icmFactor = icmCutoffFactor(bubbleFactor, profile.icmAwareness, profile.bubbleTightness);
    threeBetCutoff = clamp01(threeBetCutoff * icmFactor);
    callingCutoff = clamp01(callingCutoff * icmFactor);
  }

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

  // ICM tightening in SitD: increase fold-to-3-bet when bubble factor > 1.2
  let effectiveFoldTo3Bet = profile.foldTo3Bet;
  const bubbleFactor = getICMBubbleFactor(ctx);
  if (bubbleFactor > 1.2) {
    // Invert icmCutoffFactor to increase fold frequency (tighter = higher fold rate)
    const icmFactor = icmCutoffFactor(bubbleFactor, profile.icmAwareness, profile.bubbleTightness);
    // icmFactor < 1.0 means tighter, but foldTo3Bet increases (we fold more)
    effectiveFoldTo3Bet = clamp01(profile.foldTo3Bet / icmFactor);
  }

  // Step 2: For hands outside 4-bet range: fold or call
  const randVal = pseudoRandom(percentile);
  if (randVal < effectiveFoldTo3Bet) {
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

  let bbDefenseCutoff = clamp01(profile.bbDefenseBase * adjust * BB_DEFENSE_BONUS);
  // threeBetCutoff: same raw-threshold approach as SitC; threeBetFreq is a percentile cutoff
  // that accounts for push/fold dilution producing the measured target after dilution.
  let threeBetCutoff = clamp01(Math.min(
    profile.threeBetFreq * adjust,
    bbDefenseCutoff,
  ));

  // ICM tightening in SitE: reduce BB defense cutoff when bubble factor > 1.2
  const bubbleFactor = getICMBubbleFactor(ctx);
  if (bubbleFactor > 1.2) {
    const icmFactor = icmCutoffFactor(bubbleFactor, profile.icmAwareness, profile.bubbleTightness);
    bbDefenseCutoff = clamp01(bbDefenseCutoff * icmFactor);
    threeBetCutoff = clamp01(threeBetCutoff * icmFactor);
  }

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
  const { chips, currentBet, profile } = ctx;

  // Style-aware open-push threshold anchored to PFR (aggression).
  // Reference PFR = 0.10. Multiplier scales open-push range by preset aggression.
  // This applies ONLY for open-pushes (no prior raise). Callers like Station get floor=1.0
  // so they push Nash-tight; their VPIP comes from calling (see vpipCallFactor below).
  const REFERENCE_PFR = 0.10;
  const styleMultiplier = Math.max(1.0, profile.pfr / REFERENCE_PFR);

  // Generic linear baseline: At 1BB ~65%, at 10BB ~12%
  const rawBaseline = clamp01(ctx.effectiveStackBB <= 1
    ? 0.65
    : 0.65 - (ctx.effectiveStackBB - 1) * 0.06);

  // Profile-scaled baseline: loose presets push wider than raw formula.
  // Tight presets keep raw baseline (styleMultiplier floored at 1.0).
  const baseline = clamp01(rawBaseline * styleMultiplier);

  // Nash table lookup — used when pushFoldAccuracy = 1
  // playersToAct: approximate from activePlayers (pusher acts, rest to act)
  const playersToAct = Math.max(0, ctx.activePlayers - 1);
  // Ante detection: blind level ante > 0 indicates antes are in play
  // PreflopContext doesn't carry blindLevel directly; approximate from allStacks presence
  // A more precise ante check can be done in action-selector when building context.
  const hasAnte = ctx.hasAnte ?? false;
  const nashPushRange = getNashPushRange(
    ctx.effectiveStackBB,
    ctx.position,
    playersToAct,
    hasAnte,
  );

  // Loose presets push wider than Nash; tight presets keep Nash range (floored at 1.0).
  const scaledNashRange = clamp01(nashPushRange * styleMultiplier);

  // Interpolate between style-scaled baseline (accuracy=0) and style-scaled Nash (accuracy=1)
  const basePushThreshold = clamp01(
    baseline * (1 - profile.pushFoldAccuracy) + scaledNashRange * profile.pushFoldAccuracy,
  );

  // Apply ICM adjustment if context is available
  let pushThreshold = basePushThreshold;
  if (ctx.allStacks && ctx.payoutAmounts && ctx.playerStackIndex !== undefined) {
    const allStacks = ctx.allStacks;
    const payouts = ctx.payoutAmounts;
    const playerIdx = ctx.playerStackIndex;

    // Find a suitable opponent index (e.g., player with most chips)
    let opponentIdx = 0;
    let maxStack = 0;
    for (let i = 0; i < allStacks.length; i++) {
      if (i !== playerIdx && allStacks[i] > maxStack) {
        maxStack = allStacks[i];
        opponentIdx = i;
      }
    }

    const effectiveStack = Math.min(allStacks[playerIdx], allStacks[opponentIdx]);
    const rawBF = computeBubbleFactor(allStacks, payouts, playerIdx, opponentIdx, effectiveStack);

    // Apply bubbleTightness to scale bubble factor effect
    const effectiveBF = 1 + (rawBF - 1) * profile.bubbleTightness;

    // Apply icmAwareness: interpolate between base and ICM-adjusted
    pushThreshold = icmAdjustedThreshold(basePushThreshold, effectiveBF, profile.icmAwareness, profile.bubbleTightness);

    // Chip leader loosening: if player has 30%+ more chips than others
    // and a short stack has BF > 1.5, chip leaders can push wider
    if (allStacks[playerIdx] > 0) {
      const avgOthers = allStacks
        .filter((_, i) => i !== playerIdx)
        .reduce((sum, s) => sum + s, 0) / (allStacks.length - 1);

      if (allStacks[playerIdx] > avgOthers * 1.3) {
        // Check if there's a short stack with high bubble factor
        let maxOtherBF = 0;
        for (let i = 0; i < allStacks.length; i++) {
          if (i !== playerIdx && allStacks[i] > 0) {
            const otherBF = computeBubbleFactor(allStacks, payouts, i, playerIdx, Math.min(allStacks[i], allStacks[playerIdx]));
            maxOtherBF = Math.max(maxOtherBF, otherBF);
          }
        }
        if (maxOtherBF > 1.5) {
          // Chip leader can push 15% wider
          pushThreshold = clamp01(pushThreshold * 1.15);
        }
      }
    }
  }

  // If facing a raise (someone bet above BB), handle call/fold/shove separately.
  // When facing a raise in push/fold mode, a short-stack player can:
  //   1. Go all-in (shove over the raise — a 3-bet, but only with premium hands)
  //   2. Call (if stack is small enough relative to the raise)
  //   3. Fold
  if (ctx.facingBet > ctx.bb) {
    const pushSizeBB = ctx.facingBet / ctx.bb;
    const callAmount = Math.max(ctx.facingBet - currentBet, 1);
    const potTotal = ctx.facingBet + currentBet;
    const potOdds = potTotal / callAmount;
    const nashCallRange = getNashCallRange(ctx.effectiveStackBB, pushSizeBB, potOdds);

    // Shove-over-raise (3-bet jam): only with very premium hands, not the full push range.
    // Use Nash call range as the re-raise threshold — tighter than open-push threshold.
    // This prevents inflated 3-bet counts from push/fold mode.
    if (percentile <= nashCallRange * 0.6) {
      // Premium hand: shove over the raise (e.g., AA/KK/AKs in very short stack)
      return { action: 'RAISE', amount: chips + currentBet, situation: 'FACING_RAISE' };
    }

    // VPIP-based call widening: "calling stations" (high vpip, low pfr) call wider in
    // push/fold mode. vpipCallFactor = vpip/pfr; higher ratio = more caller vs aggressor.
    // Station (45%/8%=5.63→4.0 cap): wide calls. TAG (19%/16%=1.19): minimal widening.
    const vpipCallFactor = profile.pfr > 0 ? Math.min(profile.vpip / profile.pfr, 4.0) : 1.0;
    const baselineCallRange = baseline * 0.6;
    const nashCallThreshold = clamp01(
      baselineCallRange * (1 - profile.pushFoldAccuracy) + nashCallRange * profile.pushFoldAccuracy,
    );
    // Blend from Nash-call threshold toward vpip-based wide call as vpipCallFactor grows.
    // At factor=1.0 (pure aggressor), use Nash call. At factor=4.0 (extreme caller), use vpip-based.
    const maxCallRange = clamp01(profile.vpip * 0.8); // widest possible call range for this preset
    const blendFactor = clamp01((vpipCallFactor - 1.0) / 3.0); // 0 at factor=1, 1 at factor=4
    const callThreshold = clamp01(nashCallThreshold * (1 - blendFactor) + maxCallRange * blendFactor);

    if (percentile <= callThreshold) {
      return { action: 'CALL', amount: Math.min(callAmount, chips), situation: 'FACING_RAISE' };
    }
    return { action: 'FOLD', amount: 0, situation: 'FACING_RAISE' };
  }

  // Not facing a raise: decide whether to push or fold.
  if (percentile <= pushThreshold) {
    return { action: 'RAISE', amount: chips + currentBet, situation: 'UNOPENED' }; // All-in open push
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

// ========== ICM Helpers ==========

/**
 * Compute the cutoff multiplier for ICM tightening.
 * Returns a value <= 1.0 that scales down action thresholds.
 * Returns 1.0 when there is no ICM pressure (bubbleFactor = 1.0).
 */
function icmCutoffFactor(bubbleFactor: number, icmAwareness: number, bubbleTightness: number): number {
  if (bubbleFactor <= 1.0 || icmAwareness <= 0) return 1.0;
  const icmMultiplier = 1 / (1 + (bubbleFactor - 1) * bubbleTightness);
  return 1 - icmAwareness + icmAwareness * icmMultiplier;
}

/**
 * Compute the ICM bubble factor for the current player in the given context.
 * Returns 1.0 if ICM context is not available.
 */
function getICMBubbleFactor(ctx: PreflopContext): number {
  if (!ctx.allStacks || !ctx.payoutAmounts || ctx.playerStackIndex === undefined) {
    return 1.0;
  }

  const allStacks = ctx.allStacks;
  const payouts = ctx.payoutAmounts;
  const playerIdx = ctx.playerStackIndex;

  // Find opponent with most chips (most likely opponent)
  let opponentIdx = 0;
  let maxStack = 0;
  for (let i = 0; i < allStacks.length; i++) {
    if (i !== playerIdx && allStacks[i] > maxStack) {
      maxStack = allStacks[i];
      opponentIdx = i;
    }
  }

  const effectiveStack = Math.min(allStacks[playerIdx], allStacks[opponentIdx]);
  if (effectiveStack <= 0) return 1.0;

  return computeBubbleFactor(allStacks, payouts, playerIdx, opponentIdx, effectiveStack);
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
