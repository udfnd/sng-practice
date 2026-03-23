import type { Card, AIProfile, ActionType } from '@/types';
import { classifyHand } from './hand-classifier';
import { classifyHandBucket, type ActionLine } from './strategy-key';
import { getBoardCluster } from './board-cluster';
import { lookupPolicy, applyDeviation, sampleAction, type MixedPolicy } from './blueprint';
import { multiwayPenalty } from './spr';
import type { StageBucket, PotType, SPRBucket } from './strategy-key';

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

  // --- Phase 2: Node-identifying fields ---

  /** True if player acts after all opponents on this street (last to act) */
  inPosition?: boolean;
  /** How the pot was built preflop: limped, single raised, 3-bet, or 4-bet+ */
  potType?: 'LIMP' | 'SRP' | '3BP' | '4BP';
  /** Position matchup, e.g. 'BTNvBB', 'COvBB', 'SBvBB', 'unknown' */
  matchup?: string;
  /** Action line describing prior street action: 'first', 'afterBetCall', 'afterXX', etc. */
  actionLine?: string;
  /** Facing bet as percentage of pot (0-200+). Enables pot odds calculation. */
  betPctPot?: number;
  /** Effective stack in big blinds */
  effectiveStackBB?: number;
  /** Players remaining in tournament (for ICM stage detection) */
  playersRemaining?: number;
  /** Board cluster string for strategy lookup */
  boardCluster?: string;
}

/**
 * Make a postflop decision using blueprint-based policy lookup.
 *
 * Pipeline: classify hand → build strategy key → lookup policy →
 *           apply profile deviation → multiway adjust → sample action → resolve
 */
export function makePostflopDecision(ctx: PostflopContext, rng: () => number = Math.random): PostflopDecision {
  const { holeCards, communityCards, facingBet, profile } = ctx;
  const spr = ctx.spr ?? 5;
  const opponents = ctx.opponents ?? 1;

  // Step 1: Classify hand
  const classification = classifyHand(holeCards, communityCards);
  const handBucket = classifyHandBucket(classification, holeCards, communityCards);

  // Step 2: Build strategy key
  const boardCluster = ctx.boardCluster ?? (communityCards.length >= 3 ? getBoardCluster(communityCards) : 'mid_dry');
  const stage = getStage(ctx.playersRemaining ?? 8);
  const sprBucket = getSPRBucket(spr);
  const line = facingBet
    ? getBetFacingLine(ctx.betPctPot ?? 50)
    : ((ctx.actionLine ?? 'first') as ActionLine);

  const key = {
    stage,
    potType: (ctx.potType ?? 'SRP') as PotType,
    matchup: ctx.matchup ?? 'unknown',
    position: (ctx.inPosition ?? ctx.isAggressor) ? 'IP' as const : 'OOP' as const,
    street: ctx.street,
    line,
    spr: sprBucket,
    board: boardCluster,
    hand: handBucket,
  };

  // Step 3: Lookup baseline policy
  let policy = lookupPolicy(key);

  // Step 4: Apply profile deviation (personality layer, bounded ±8%)
  policy = applyDeviation(policy, profile, facingBet);

  // Step 5: Multiway adjustment (reduce aggression with multiple opponents)
  if (opponents > 1 && !facingBet) {
    const penalty = multiwayPenalty(opponents);
    policy = applyMultiwayPenalty(policy, penalty);
  }

  // Step 6: BvB adjustment
  if (ctx.isBvB) {
    policy = applyBvBAdjustment(policy, facingBet);
  }

  // Step 7: Enforce action constraints based on context
  if (facingBet) {
    // Facing bet: only fold/call/raise allowed
    policy = { ...policy, check: 0, bet33: 0, bet66: 0, bet100: 0 };
    policy = normalizePolicy(policy);
  } else {
    // Not facing bet: only check/bet allowed (no fold/call, raise only as "bet")
    policy = { ...policy, fold: 0, call: 0, raise: 0 };
    policy = normalizePolicy(policy);
  }

  // Step 8: Sample action
  const action = sampleAction(policy, rng);

  // Step 9: Resolve to PostflopDecision with chip amounts
  return resolveAction(action, ctx);
}

// ---------------------------------------------------------------------------
// Action resolution
// ---------------------------------------------------------------------------

function resolveAction(
  action: ReturnType<typeof sampleAction>,
  ctx: PostflopContext,
): PostflopDecision {
  const { potSize, chips, bb, facingAmount } = ctx;

  switch (action.type) {
    case 'CHECK':
      return { action: 'CHECK', amount: 0 };

    case 'FOLD':
      return { action: 'FOLD', amount: 0 };

    case 'CALL': {
      const callAmount = Math.min(facingAmount, chips);
      return { action: 'CALL', amount: callAmount };
    }

    case 'BET': {
      const sizePct = action.sizePctPot / 100;
      const betSize = Math.round(potSize * sizePct);
      const amount = Math.min(Math.max(betSize, bb), chips);
      return { action: 'BET', amount };
    }

    case 'RAISE': {
      const raiseSize = Math.min(Math.round(facingAmount * 3), chips);
      return { action: 'RAISE', amount: raiseSize };
    }
  }
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

function applyMultiwayPenalty(policy: MixedPolicy, penalty: number): MixedPolicy {
  // Reduce betting, increase checking
  const reduction = 1 - penalty; // e.g., 0.35 for 2 opponents
  return {
    check: Math.round(policy.check + (policy.bet33 + policy.bet66 + policy.bet100) * reduction * 0.7),
    bet33: Math.round(policy.bet33 * penalty),
    bet66: Math.round(policy.bet66 * penalty),
    bet100: Math.round(policy.bet100 * penalty),
    fold: policy.fold,
    call: policy.call,
    raise: Math.round(policy.raise * penalty),
  };
}

function applyBvBAdjustment(policy: MixedPolicy, isFacingBet: boolean): MixedPolicy {
  if (isFacingBet) {
    // BvB: defend wider (fold less)
    return {
      ...policy,
      fold: Math.round(policy.fold * 0.85),
      call: Math.round(policy.call * 1.1),
      raise: policy.raise,
    };
  }
  // BvB aggressor: bet more
  return {
    ...policy,
    check: Math.round(policy.check * 0.85),
    bet33: Math.round(policy.bet33 * 1.15),
    bet66: Math.round(policy.bet66 * 1.15),
    bet100: policy.bet100,
  };
}

function normalizePolicy(p: MixedPolicy): MixedPolicy {
  const total = p.check + p.bet33 + p.bet66 + p.bet100 + p.fold + p.call + p.raise;
  if (total === 0) return { check: 1000, bet33: 0, bet66: 0, bet100: 0, fold: 0, call: 0, raise: 0 };
  const scale = 1000 / total;
  return {
    check: Math.round(p.check * scale),
    bet33: Math.round(p.bet33 * scale),
    bet66: Math.round(p.bet66 * scale),
    bet100: Math.round(p.bet100 * scale),
    fold: Math.round(p.fold * scale),
    call: Math.round(p.call * scale),
    raise: Math.round(p.raise * scale),
  };
}

// ---------------------------------------------------------------------------
// Helpers (duplicated from strategy-key.ts to avoid circular dependency)
// ---------------------------------------------------------------------------

function getSPRBucket(spr: number): SPRBucket {
  if (spr < 2) return 'lt2';
  if (spr < 4) return '2to4';
  if (spr < 8) return '4to8';
  return '8plus';
}

function getStage(playersRemaining: number): StageBucket {
  if (playersRemaining <= 2) return 'hu';
  if (playersRemaining === 3) return '3left';
  if (playersRemaining === 4) return 'bubble';
  return 'chipEV';
}

function getBetFacingLine(betPctPot: number): ActionLine {
  if (betPctPot <= 28) return 'vs25';
  if (betPctPot <= 40) return 'vs33';
  if (betPctPot <= 62) return 'vs50';
  if (betPctPot <= 87) return 'vs75';
  if (betPctPot <= 110) return 'vs100';
  return 'vsOverbet';
}
