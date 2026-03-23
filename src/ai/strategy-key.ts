import type { Card } from '@/types';
import { classifyHand } from './hand-classifier';
import { getBoardCluster } from './board-cluster';

/**
 * ICM stage bucket for strategy adjustment.
 * - chipEV: Early tournament, play for chips
 * - bubble: Near the money bubble (tighten significantly)
 * - itm: In the money (can open up slightly)
 * - 3left: 3 players remaining
 * - hu: Heads-up play
 */
export type StageBucket = 'chipEV' | 'bubble' | 'itm' | '3left' | 'hu';

/**
 * Pot type from preflop action.
 */
export type PotType = 'LIMP' | 'SRP' | '3BP' | '4BP';

/**
 * Position relative to opponent (IP = In Position, OOP = Out of Position).
 */
export type RelativePosition = 'IP' | 'OOP';

/**
 * SPR bucket for strategy granularity.
 */
export type SPRBucket = 'lt2' | '2to4' | '4to8' | '8plus';

/**
 * Action line describing what has happened so far on the current street.
 */
export type ActionLine =
  | 'first'          // First to act, no prior action this street
  | 'vs25'           // Facing ~25% pot bet
  | 'vs33'           // Facing ~33% pot bet
  | 'vs50'           // Facing ~50% pot bet
  | 'vs75'           // Facing ~75% pot bet
  | 'vs100'          // Facing ~100% pot bet
  | 'vsOverbet'      // Facing overbet (>100% pot)
  | 'afterBetCall'   // After betting and getting called (next street)
  | 'afterXX'        // After check-check (both checked previous street)
  | 'afterXRCall'    // After check-raise and call
  | 'afterBarrelCall'; // After barrel (turn/river bet) and call

/**
 * Hand bucket for strategy lookup — more granular than MadeHandTier.
 * These map to solver-style hand categories.
 */
export type HandBucket =
  | 'nuts'             // Quads, straight flush, nut full house
  | 'strong_value'     // Non-nut flush, non-nut straight, set, top two pair
  | 'overpair'         // Pocket pair above board
  | 'tp_good'          // Top pair + good kicker (10+)
  | 'tp_weak'          // Top pair + weak kicker
  | 'second_pair'      // Second pair
  | 'weak_pair'        // Underpair, bottom pair, third pair
  | 'nut_fd'           // Nut flush draw (no made hand)
  | 'flush_draw'       // Non-nut flush draw
  | 'oesd'             // Open-ended straight draw
  | 'pair_plus_draw'   // Pair + flush/straight draw combo
  | 'gutshot_overs'    // Gutshot + overcards
  | 'Ahi_bdfd'         // Ace-high with backdoor flush draw
  | 'showdown_high'    // King-high, ace-high (marginal showdown)
  | 'blocker_bluff'    // Has top card blocker but no hand
  | 'air';             // Nothing

/**
 * Strategy key — uniquely identifies a decision node for policy lookup.
 * In Phase 3, this will be used to look up mixed action policies from blueprint tables.
 */
export interface StrategyKey {
  stage: StageBucket;
  potType: PotType;
  matchup: string;           // e.g. 'BTNvBB', 'COvBB', 'SBvBB'
  position: RelativePosition;
  street: 'FLOP' | 'TURN' | 'RIVER';
  line: ActionLine;
  spr: SPRBucket;
  board: string;             // Board cluster string
  hand: HandBucket;
}

/**
 * Build a strategy key from rich context.
 */
export function buildStrategyKey(ctx: {
  holeCards: [Card, Card];
  communityCards: Card[];
  street: 'FLOP' | 'TURN' | 'RIVER';
  inPosition?: boolean;
  potType?: PotType;
  matchup?: string;
  actionLine?: ActionLine;
  spr?: number;
  playersRemaining?: number;
  facingBet?: boolean;
  betPctPot?: number;
}): StrategyKey {
  const classification = classifyHand(ctx.holeCards, ctx.communityCards);
  const boardCluster = getBoardCluster(ctx.communityCards);
  const handBucket = classifyHandBucket(classification, ctx.holeCards, ctx.communityCards);
  const sprBucket = getSPRBucket(ctx.spr ?? 5);
  const stage = getStage(ctx.playersRemaining ?? 8);
  const line = ctx.facingBet
    ? getBetFacingLine(ctx.betPctPot ?? 50)
    : (ctx.actionLine ?? 'first');

  return {
    stage,
    potType: ctx.potType ?? 'SRP',
    matchup: ctx.matchup ?? 'unknown',
    position: ctx.inPosition ? 'IP' : 'OOP',
    street: ctx.street,
    line,
    spr: sprBucket,
    board: boardCluster,
    hand: handBucket,
  };
}

/**
 * Classify a hand into a strategic bucket for policy lookup.
 */
export function classifyHandBucket(
  classification: ReturnType<typeof classifyHand>,
  holeCards: [Card, Card],
  communityCards: Card[],
): HandBucket {
  const { madeTier, drawTier, handCategory, isNutDraw, hasTopBlocker, backdoorFlush } = classification;

  // Nuts: quads+, strong full house
  if (handCategory >= 7) return 'nuts'; // FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH
  if (handCategory === 6) return 'nuts'; // FULL_HOUSE

  // Strong value: flush, straight, set, top two pair
  if (handCategory === 5) return 'strong_value'; // FLUSH
  if (handCategory === 4) return 'strong_value'; // STRAIGHT
  if (handCategory === 3) return 'strong_value'; // THREE_OF_A_KIND (set or trips)

  // Two pair
  if (handCategory === 2) {
    if (madeTier === 1) return 'strong_value'; // Top two pair
    return 'second_pair'; // Weaker two pair treated similarly to second pair in strategy
  }

  // ONE_PAIR with draws = combo
  if (handCategory === 1 && drawTier >= 3) {
    return 'pair_plus_draw';
  }

  // Overpair
  if (handCategory === 1 && madeTier === 1) {
    const sorted = [holeCards[0].rank, holeCards[1].rank].sort((a, b) => b - a);
    if (sorted[0] === sorted[1] && sorted[0]! > (communityCards[0]?.rank ?? 0)) {
      return 'overpair';
    }
    return 'tp_good'; // Top pair strong kicker
  }

  // Top pair weak, second pair
  if (handCategory === 1 && madeTier === 2) {
    const boardTop = Math.max(...communityCards.map((c) => c.rank));
    if (holeCards[0].rank === boardTop || holeCards[1].rank === boardTop) {
      return 'tp_weak';
    }
    return 'second_pair';
  }

  // Weak pair
  if (handCategory === 1 && madeTier >= 3) {
    return 'weak_pair';
  }

  // --- No made hand (HIGH_CARD) — classify by draws ---

  // Nut flush draw
  if (isNutDraw && drawTier >= 4) return 'nut_fd';

  // Non-nut flush draw
  if (drawTier >= 3) return 'flush_draw';

  // OESD
  if (drawTier === 2) return 'oesd';

  // Gutshot + overcards
  if (drawTier === 1) {
    const boardTop = Math.max(...communityCards.map((c) => c.rank));
    const hasOvercards = holeCards[0].rank > boardTop || holeCards[1].rank > boardTop;
    if (hasOvercards) return 'gutshot_overs';
  }

  // Ace-high with backdoor flush draw
  if (holeCards[0].rank === 14 || holeCards[1].rank === 14) {
    if (backdoorFlush) return 'Ahi_bdfd';
    return 'showdown_high';
  }

  // King-high showdown
  if (holeCards[0].rank === 13 || holeCards[1].rank === 13) {
    return 'showdown_high';
  }

  // Blocker bluff (holding a card that blocks opponent's top pair)
  if (hasTopBlocker && madeTier === 4) {
    return 'blocker_bluff';
  }

  return 'air';
}

// ---------------------------------------------------------------------------
// Helpers
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
  // Bubble: typically players = payoutPlaces + 1 (for top-3 payout, bubble at 4 players)
  if (playersRemaining === 4) return 'bubble';
  if (playersRemaining <= 3) return 'itm';
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
