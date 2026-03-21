import type { Card, AIProfile, ActionType } from '@/types';
import { analyzeBoardTexture, textureAdjustment } from './board-texture';
import { classifyHand, type MadeHandTier, type DrawTier } from './hand-classifier';
import { sprBetSizing, planBetSizing, rangeAdvantageScore, multiwayPenalty } from './spr';

export interface PostflopDecision {
  action: ActionType;
  amount: number;
}

export interface PostflopContext {
  profile: AIProfile;
  holeCards: [Card, Card];
  communityCards: Card[];
  /** Current street: 'FLOP' | 'TURN' | 'RIVER' */
  street: 'FLOP' | 'TURN' | 'RIVER';
  /** Is this player the preflop aggressor? */
  isAggressor: boolean;
  /** Is this player facing a bet? */
  facingBet: boolean;
  /** Current bet amount to face */
  facingAmount: number;
  /** Current pot size */
  potSize: number;
  /** Player's remaining chips */
  chips: number;
  /** The BB amount */
  bb: number;
  /** Stack-to-Pot Ratio (effective stack / pot). Defaults to 5 if not provided. */
  spr?: number;
  /** Number of active non-folded opponents. Defaults to 1 if not provided. */
  opponents?: number;
  /** True when this is a blind vs blind (SB vs BB) heads-up pot. Defaults to false. */
  isBvB?: boolean;
}

/**
 * Compute board-dependent check-raise frequency modifier.
 *
 * Milestone 2: Board-Dependent Check-Raise
 */
function boardDependentCheckRaiseFreq(
  baseFreq: number,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  communityCards: Card[],
): number {
  const detail = analyzeBoardTexture(communityCards);
  let freq = baseFreq;

  // Apply board category multiplier
  switch (detail.category) {
    case 'dry':      freq *= 0.5;  break;
    case 'wet':      freq *= 1.3;  break;
    case 'monotone': freq *= 1.3;  break;
    case 'paired':   freq *= 0.8;  break;
  }

  // Boost for combo draws (made tier 1-2 AND draw tier 1-2)
  if (madeTier <= 2 && drawTier <= 2 && drawTier > 0) {
    freq *= 1.4;
  }

  return clamp01(freq);
}

/**
 * Make a postflop decision.
 */
// @MX:TODO | Missing integration tests for aggressor cbet, facing bet, passive decision paths
export function makePostflopDecision(ctx: PostflopContext, rng: () => number = Math.random): PostflopDecision {
  const { holeCards, communityCards, isAggressor, facingBet } = ctx;
  const detail = analyzeBoardTexture(communityCards);
  const classification = classifyHand(holeCards, communityCards);
  const texAdj = textureAdjustment(detail.category);

  if (facingBet) {
    return facingBetDecision(ctx, classification.madeTier, classification.drawTier, texAdj, detail, rng);
  }

  if (isAggressor) {
    return aggressorDecision(ctx, classification.madeTier, classification.drawTier, texAdj, detail, rng);
  }

  // Not aggressor, not facing bet: check or bet (possibly donk)
  return passiveDecision(ctx, classification.madeTier, classification.drawTier, detail, rng);
}

/**
 * Aggressor continuation bet / barrel logic.
 *
 * Milestone 3: Barrel Planning & Pot Geometry integrated.
 * Milestone 5: BvB +15-25% c-bet/barrel frequencies.
 */
function aggressorDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  texAdj: number,
  detail: ReturnType<typeof analyzeBoardTexture>,
  rng: () => number,
): PostflopDecision {
  const { profile, street, communityCards, potSize, chips, bb } = ctx;
  const spr = ctx.spr ?? 5;
  const opponents = ctx.opponents ?? 1;
  const isBvB = ctx.isBvB ?? false;

  let betFreq: number;
  switch (street) {
    case 'FLOP': betFreq = profile.cBetFreq; break;
    case 'TURN': betFreq = profile.turnBarrel; break;
    case 'RIVER': betFreq = profile.riverBarrel; break;
  }

  // Apply texture adjustment (on every street)
  betFreq = clamp01(betFreq + texAdj);

  // Milestone 1: On turn/river, reduce barrel frequency if flush/straight completes
  if (street !== 'FLOP' && (detail.flushComplete || detail.straightComplete)) {
    betFreq = clamp01(betFreq * 0.8);
  }

  // Range advantage adjustment: high advantage → bet more, low → check more
  const rangeAdv = rangeAdvantageScore(communityCards, true);
  betFreq = clamp01(betFreq + rangeAdv * 0.15);

  // Multiway penalty: reduce c-bet frequency as opponents increase
  betFreq = clamp01(betFreq * multiwayPenalty(opponents));

  // Milestone 5: BvB adjustments — +15-25% c-bet/barrel frequencies
  if (isBvB) {
    betFreq = clamp01(betFreq * 1.20);
  }

  // Made hand tier adjustment
  betFreq = adjustForMadeHand(betFreq, madeTier);

  // Bluff with draws (semi-bluff priority)
  if (madeTier >= 3 && drawTier >= 2) {
    // Semi-bluff: increase bet frequency
    betFreq = clamp01(betFreq + profile.bluffFreq * 0.6);
  } else if (madeTier === 4 && drawTier === 0) {
    // Pure air: bluff at reduced frequency
    betFreq = clamp01(profile.bluffFreq * 0.4);
  }

  // Milestone 3: River polarization — tier 1 or bluff bets big, tier 2-3 checks more
  if (street === 'RIVER') {
    const riverPol = profile.riverPolarization ?? 0.5;
    if (madeTier === 2 || madeTier === 3) {
      // Middle strength hands check more on river (polarized strategy)
      betFreq = clamp01(betFreq * (1 - riverPol * 0.5));
    } else if (madeTier === 4) {
      // Pure bluff on river with polarization boost
      betFreq = clamp01(betFreq * (1 + riverPol * 0.3));
    }
    // Tier 1 keeps high bet frequency (value bet)
  }

  if (rng() < betFreq) {
    // Milestone 3: Use planBetSizing for street-appropriate sizing
    const plan = planBetSizing(spr);
    const streetIndex = street === 'FLOP' ? 0 : street === 'TURN' ? 1 : 2;
    const planSize = plan[Math.min(streetIndex, plan.length - 1)] ?? sprBetSizing(spr);

    // Blend: weight plan recommendation 70%, preset 30%
    const blendedSize = planSize * 0.7 + profile.cBetSize * 0.3;
    const betSize = Math.round(potSize * blendedSize);
    const amount = Math.min(Math.max(betSize, bb), chips);
    return { action: 'BET', amount };
  }

  return { action: 'CHECK', amount: 0 };
}

/**
 * Facing bet defense logic.
 *
 * Milestone 2: Board-Dependent Check-Raise.
 * Milestone 5: BvB -15% fold frequencies.
 */
function facingBetDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  _texAdj: number,
  detail: ReturnType<typeof analyzeBoardTexture>,
  rng: () => number,
): PostflopDecision {
  const { profile, facingAmount, chips, communityCards } = ctx;
  const isBvB = ctx.isBvB ?? false;

  let foldFreq = profile.foldToCBet;

  // Adjust fold frequency by hand strength
  switch (madeTier) {
    case 1: foldFreq *= 0.1; break;   // Almost never fold strong hands
    case 2: foldFreq *= 0.5; break;   // Halve fold freq for decent hands
    case 3: foldFreq *= 0.8; break;   // Slightly reduce
    case 4: foldFreq *= 1.2; break;   // More likely to fold
  }

  // Draws reduce fold frequency
  if (drawTier >= 2) foldFreq *= 0.5;
  if (drawTier >= 3) foldFreq *= 0.8;

  // Milestone 5: BvB -15% fold frequencies
  if (isBvB) {
    foldFreq *= 0.85;
  }

  foldFreq = clamp01(foldFreq);

  // Milestone 2: Board-dependent check-raise
  const crFreq = boardDependentCheckRaiseFreq(
    profile.checkRaiseFreq,
    madeTier,
    drawTier,
    communityCards,
  );

  // Check-raise with strong hands (tier 1) or when board-dependent freq fires
  if (madeTier === 1 && rng() < crFreq) {
    const raiseSize = Math.min(Math.round(facingAmount * 3), chips);
    return { action: 'RAISE', amount: raiseSize };
  }

  if (rng() < foldFreq) {
    return { action: 'FOLD', amount: 0 };
  }

  // Call
  const callAmount = Math.min(facingAmount, chips);
  return { action: 'CALL', amount: callAmount };
}

/**
 * Passive (not aggressor, not facing bet) — check or lead (donk bet).
 *
 * Milestone 4: Donk Betting when rangeAdvantage < -0.3.
 * Milestone 5: BvB +20% donk frequency for BB.
 */
function passiveDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  detail: ReturnType<typeof analyzeBoardTexture>,
  rng: () => number,
): PostflopDecision {
  const { profile, potSize, chips, bb, communityCards } = ctx;
  const spr = ctx.spr ?? 5;
  const isBvB = ctx.isBvB ?? false;

  // Milestone 4: Donk betting — when board favors the caller's range
  const rangeAdv = rangeAdvantageScore(communityCards, false); // From caller's perspective
  const donkBetFreq = profile.donkBetFreq ?? 0;

  if (donkBetFreq > 0 && rangeAdv > 0.3) {
    // Board favors the out-of-position player (caller)
    let adjustedDonkFreq = donkBetFreq;

    // Milestone 5: BvB +20% donk frequency for BB
    if (isBvB) {
      adjustedDonkFreq = clamp01(adjustedDonkFreq * 1.20);
    }

    // Stronger hands donate more aggressively
    if (madeTier <= 2) adjustedDonkFreq *= 1.3;
    if (drawTier >= 2) adjustedDonkFreq *= 1.2;

    adjustedDonkFreq = clamp01(adjustedDonkFreq);

    if (rng() < adjustedDonkFreq) {
      // Donk bet sizing: 33-50% pot
      const donkSize = potSize * (0.33 + rng() * 0.17); // 33-50%
      const betSize = Math.round(donkSize);
      return { action: 'BET', amount: Math.min(Math.max(betSize, bb), chips) };
    }
  }

  // Lead with very strong hands occasionally
  if (madeTier === 1 && rng() < 0.3) {
    const sprSize = sprBetSizing(spr);
    const blendedSize = sprSize * 0.7 + profile.cBetSize * 0.3;
    const betSize = Math.round(potSize * blendedSize);
    return { action: 'BET', amount: Math.min(Math.max(betSize, bb), chips) };
  }

  // Semi-bluff lead with strong draws
  if (drawTier >= 2 && rng() < profile.bluffFreq * 0.3) {
    const betSize = Math.round(potSize * 0.5);
    return { action: 'BET', amount: Math.min(Math.max(betSize, bb), chips) };
  }

  return { action: 'CHECK', amount: 0 };
}

function adjustForMadeHand(baseFreq: number, tier: MadeHandTier): number {
  switch (tier) {
    case 1: return clamp01(baseFreq + 0.20);  // Always bet strong
    case 2: return clamp01(baseFreq + 0.05);
    case 3: return clamp01(baseFreq - 0.10);
    case 4: return clamp01(baseFreq - 0.30);  // Rarely bet with nothing
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
