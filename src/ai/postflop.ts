import type { Card, AIProfile, ActionType } from '@/types';
import { analyzeBoardTexture, textureAdjustment } from './board-texture';
import { classifyHand, type MadeHandTier, type DrawTier } from './hand-classifier';

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
}

/**
 * Make a postflop decision.
 */
// @MX:TODO | Missing integration tests for aggressor cbet, facing bet, passive decision paths
export function makePostflopDecision(ctx: PostflopContext, rng: () => number = Math.random): PostflopDecision {
  const { holeCards, communityCards, isAggressor, facingBet } = ctx;
  const texture = analyzeBoardTexture(communityCards);
  const classification = classifyHand(holeCards, communityCards);
  const texAdj = textureAdjustment(texture);

  if (facingBet) {
    return facingBetDecision(ctx, classification.madeTier, classification.drawTier, texAdj, rng);
  }

  if (isAggressor) {
    return aggressorDecision(ctx, classification.madeTier, classification.drawTier, texAdj, rng);
  }

  // Not aggressor, not facing bet: check or bet
  return passiveDecision(ctx, classification.madeTier, classification.drawTier, rng);
}

/**
 * Aggressor continuation bet / barrel logic.
 */
function aggressorDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  texAdj: number,
  rng: () => number,
): PostflopDecision {
  const { profile, street, potSize, chips, bb } = ctx;

  let betFreq: number;
  switch (street) {
    case 'FLOP': betFreq = profile.cBetFreq; break;
    case 'TURN': betFreq = profile.turnBarrel; break;
    case 'RIVER': betFreq = profile.riverBarrel; break;
  }

  // Apply texture adjustment
  betFreq = clamp01(betFreq + texAdj);

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

  if (rng() < betFreq) {
    const betSize = Math.round(potSize * profile.cBetSize);
    const amount = Math.min(Math.max(betSize, bb), chips);
    return { action: 'BET', amount };
  }

  return { action: 'CHECK', amount: 0 };
}

/**
 * Facing bet defense logic.
 */
function facingBetDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  _texAdj: number,
  rng: () => number,
): PostflopDecision {
  const { profile, facingAmount, chips } = ctx;

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

  foldFreq = clamp01(foldFreq);

  // Check-raise with strong hands
  if (madeTier === 1 && rng() < profile.checkRaiseFreq) {
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
 * Passive (not aggressor, not facing bet) — check or lead.
 */
function passiveDecision(
  ctx: PostflopContext,
  madeTier: MadeHandTier,
  drawTier: DrawTier,
  rng: () => number,
): PostflopDecision {
  const { profile, potSize, chips, bb } = ctx;

  // Lead with very strong hands occasionally
  if (madeTier === 1 && rng() < 0.3) {
    const betSize = Math.round(potSize * profile.cBetSize);
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
