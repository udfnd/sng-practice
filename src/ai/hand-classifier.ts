import type { Card } from '@/types';
import { evaluate7, HandCategory, type HandCategoryType } from '@/engine/evaluator';

/**
 * Made hand strength tiers (1 = strongest, 4 = weakest).
 *
 * Tier 1 (Strong): Quads, full house, flush, straight, set, top two pair,
 *                   overpair, top pair + strong kicker (10+)
 * Tier 2 (Decent): Bottom two pair, top pair weak kicker, second pair
 * Tier 3 (Marginal): Underpair, third/bottom pair, ace-high
 * Tier 4 (Air): No pair, no meaningful showdown value
 */
export type MadeHandTier = 1 | 2 | 3 | 4;

/**
 * Draw strength tiers. Higher = stronger.
 *
 * 0: No draw
 * 1: Gutshot straight draw
 * 2: Open-ended straight draw (OESD)
 * 3: Non-nut flush draw
 * 4: Nut flush draw or combo draw (flush + straight, pair + strong draw)
 */
export type DrawTier = 0 | 1 | 2 | 3 | 4;

export interface HandClassification {
  madeTier: MadeHandTier;
  drawTier: DrawTier;
  madeDescription: string;
  drawDescription: string;

  /** Evaluator hand category (0=high card .. 9=royal flush) */
  handCategory: HandCategoryType;
  /** Numeric rank from evaluator for precise comparison */
  handRank: number;
  /** 0.0 (air) to 1.0 (nuts) — relative strength on this board */
  nutStrength: number;
  /** True if holding the nut flush draw */
  isNutDraw: boolean;
  /** True if hole card blocks opponent's likely top hands */
  hasTopBlocker: boolean;
  /** True if backdoor flush draw exists (flop only: 2-to-flush with 1+ hole card) */
  backdoorFlush: boolean;
  /** True if backdoor straight draw exists (flop only: 3-to-straight) */
  backdoorStraight: boolean;
}

/**
 * Classify a hand's made strength and draw potential.
 * Uses the full evaluate7 evaluator for accurate hand recognition.
 */
export function classifyHand(
  holeCards: [Card, Card],
  communityCards: Card[],
): HandClassification {
  const allCards = [...holeCards, ...communityCards];
  const evaluated = evaluate7(allCards);
  const boardRanks = communityCards.map((c) => c.rank).sort((a, b) => b - a);
  const holeRanks = [holeCards[0].rank, holeCards[1].rank].sort((a, b) => b - a) as [number, number];

  const made = classifyMadeHand(evaluated.category, holeRanks, boardRanks, holeCards, communityCards);
  const draw = classifyDraws(holeCards, communityCards);
  const nutStrength = computeNutStrength(evaluated.category, made.tier, holeRanks, boardRanks);
  const topBlocker = detectTopBlocker(holeRanks, boardRanks);

  return {
    madeTier: made.tier,
    drawTier: draw.tier,
    madeDescription: made.description,
    drawDescription: draw.description,
    handCategory: evaluated.category,
    handRank: evaluated.rank,
    nutStrength,
    isNutDraw: draw.isNutDraw,
    hasTopBlocker: topBlocker,
    backdoorFlush: draw.backdoorFlush,
    backdoorStraight: draw.backdoorStraight,
  };
}

// ---------------------------------------------------------------------------
// Made hand classification (using evaluator category)
// ---------------------------------------------------------------------------

function classifyMadeHand(
  category: HandCategoryType,
  holeRanks: [number, number],
  boardRanks: number[],
  holeCards: [Card, Card],
  communityCards: Card[],
): { tier: MadeHandTier; description: string } {
  const [high, low] = holeRanks;
  const topBoardCard = boardRanks[0] ?? 0;

  // --- Category >= TWO_PAIR: always tier 1 ---
  if (category >= HandCategory.STRAIGHT_FLUSH) {
    return { tier: 1, description: 'Straight flush' };
  }
  if (category === HandCategory.FOUR_OF_A_KIND) {
    return { tier: 1, description: 'Four of a kind' };
  }
  if (category === HandCategory.FULL_HOUSE) {
    return { tier: 1, description: 'Full house' };
  }
  if (category === HandCategory.FLUSH) {
    // Check if using both hole cards for the flush (stronger)
    const flushSuit = detectFlushSuit(communityCards);
    if (flushSuit && holeCards[0].suit === flushSuit && holeCards[1].suit === flushSuit) {
      return { tier: 1, description: 'Flush (two hole cards)' };
    }
    return { tier: 1, description: 'Flush' };
  }
  if (category === HandCategory.STRAIGHT) {
    return { tier: 1, description: 'Straight' };
  }
  if (category === HandCategory.THREE_OF_A_KIND) {
    // Set (pocket pair + board card) vs trips (one hole card + board pair)
    if (high === low) {
      return { tier: 1, description: 'Set' };
    }
    // Trips: weaker than set but still strong
    return { tier: 1, description: 'Trips' };
  }
  if (category === HandCategory.TWO_PAIR) {
    // Check if both hole cards contribute to the two pair
    const boardPairRanks = findBoardPairRanks(communityCards);
    const holePairContribution = countHolePairContribution(holeRanks, boardRanks, boardPairRanks);

    if (holePairContribution >= 2) {
      // Both hole cards pair the board = top two pair (strong)
      // Check if one of them is top pair
      if (high === topBoardCard || low === topBoardCard) {
        return { tier: 1, description: 'Top two pair' };
      }
      return { tier: 2, description: 'Two pair' };
    }
    // One hole card + board pair = weaker two pair
    return { tier: 2, description: 'Two pair (one board pair)' };
  }

  // --- ONE_PAIR: classify by pair type ---
  if (category === HandCategory.ONE_PAIR) {
    return classifyOnePair(holeRanks, boardRanks);
  }

  // --- HIGH_CARD ---
  if (high === 14) {
    return { tier: 3, description: 'Ace high' };
  }
  if (high === 13) {
    return { tier: 3, description: 'King high' };
  }
  return { tier: 4, description: 'No pair' };
}

function classifyOnePair(
  holeRanks: [number, number],
  boardRanks: number[],
): { tier: MadeHandTier; description: string } {
  const [high, low] = holeRanks;
  const topBoardCard = boardRanks[0] ?? 0;
  const secondBoardCard = boardRanks[1] ?? 0;

  // Pocket pair (overpair / underpair)
  if (high === low) {
    if (high > topBoardCard) {
      return { tier: 1, description: 'Overpair' };
    }
    if (high > secondBoardCard) {
      return { tier: 2, description: 'Second overpair' };
    }
    return { tier: 3, description: 'Underpair' };
  }

  // Top pair
  if (high === topBoardCard || low === topBoardCard) {
    const kicker = high === topBoardCard ? low : high;
    if (kicker >= 10) {
      return { tier: 1, description: 'Top pair, strong kicker' };
    }
    return { tier: 2, description: 'Top pair, weak kicker' };
  }

  // Second pair
  if (high === secondBoardCard || low === secondBoardCard) {
    return { tier: 2, description: 'Second pair' };
  }

  // Third pair or lower
  for (const br of boardRanks.slice(2)) {
    if (high === br || low === br) {
      return { tier: 3, description: 'Bottom pair' };
    }
  }

  // Pocket pair below board (shouldn't reach here normally, but safety)
  return { tier: 3, description: 'Low pair' };
}

// ---------------------------------------------------------------------------
// Draw classification (higher tier = stronger draw)
// ---------------------------------------------------------------------------

function classifyDraws(
  holeCards: [Card, Card],
  communityCards: Card[],
): { tier: DrawTier; description: string; isNutDraw: boolean; backdoorFlush: boolean; backdoorStraight: boolean } {
  const isFlop = communityCards.length === 3;

  // --- Flush draw detection ---
  const flushDrawInfo = detectFlushDraw(holeCards, communityCards);
  const hasFlushDraw = flushDrawInfo.hasFlushDraw;
  const isNutFlushDraw = flushDrawInfo.isNutDraw;

  // --- Straight draw detection ---
  const straightInfo = detectStraightDraws(holeCards, communityCards);

  // --- Backdoor draws (flop only) ---
  const backdoorFlush = isFlop ? detectBackdoorFlush(holeCards, communityCards) : false;
  const backdoorStraight = isFlop ? detectBackdoorStraight(holeCards, communityCards) : false;

  // --- Pair + draw detection ---
  const hasPairWithBoard = holeCards.some((hc) =>
    communityCards.some((cc) => cc.rank === hc.rank),
  );
  const hasPocketPair = holeCards[0].rank === holeCards[1].rank;
  const hasPair = hasPairWithBoard || hasPocketPair;

  // --- Combo draw: flush + straight, or pair + strong draw ---
  if (hasFlushDraw && straightInfo.oesd) {
    return { tier: 4, description: 'Combo draw (flush + straight)', isNutDraw: isNutFlushDraw, backdoorFlush, backdoorStraight };
  }
  if (isNutFlushDraw && hasPair) {
    return { tier: 4, description: 'Combo draw (pair + nut flush draw)', isNutDraw: true, backdoorFlush, backdoorStraight };
  }
  if (hasPair && hasFlushDraw) {
    return { tier: 4, description: 'Combo draw (pair + flush draw)', isNutDraw: isNutFlushDraw, backdoorFlush, backdoorStraight };
  }
  if (hasPair && straightInfo.oesd) {
    return { tier: 4, description: 'Combo draw (pair + OESD)', isNutDraw: false, backdoorFlush, backdoorStraight };
  }

  // --- Nut flush draw (without combo) ---
  if (isNutFlushDraw) {
    return { tier: 4, description: 'Nut flush draw', isNutDraw: true, backdoorFlush, backdoorStraight };
  }

  // --- Non-nut flush draw ---
  if (hasFlushDraw) {
    return { tier: 3, description: 'Flush draw', isNutDraw: false, backdoorFlush, backdoorStraight };
  }

  // --- OESD ---
  if (straightInfo.oesd) {
    return { tier: 2, description: 'Open-ended straight draw', isNutDraw: false, backdoorFlush, backdoorStraight };
  }

  // --- Gutshot ---
  if (straightInfo.gutshot) {
    return { tier: 1, description: 'Gutshot', isNutDraw: false, backdoorFlush, backdoorStraight };
  }

  return { tier: 0, description: 'No draw', isNutDraw: false, backdoorFlush, backdoorStraight };
}

// ---------------------------------------------------------------------------
// Flush draw helpers
// ---------------------------------------------------------------------------

function detectFlushDraw(
  holeCards: [Card, Card],
  communityCards: Card[],
): { hasFlushDraw: boolean; isNutDraw: boolean } {
  const allCards = [...holeCards, ...communityCards];
  const suitCounts = new Map<string, number>();

  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }

  for (const [suit, count] of suitCounts) {
    // 4 to a flush (not completed flush — that's a made hand)
    if (count === 4) {
      const holeCardsInSuit = holeCards.filter((c) => c.suit === suit);
      if (holeCardsInSuit.length === 0) continue; // Board-only flush draw, not ours

      // Check if this is the nut flush draw
      // Find the highest card in this suit NOT on the board
      const boardSuitRanks = communityCards
        .filter((c) => c.suit === suit)
        .map((c) => c.rank)
        .sort((a, b) => b - a);
      const holeSuitRanks = holeCardsInSuit.map((c) => c.rank).sort((a, b) => b - a);

      // Nut flush draw: our highest suited card is higher than all board suited cards
      // and is the Ace (absolute nut) or is the highest possible
      const highestHoleSuitRank = holeSuitRanks[0]!;
      const highestBoardSuitRank = boardSuitRanks[0] ?? 0;

      // The nut flush draw means our hole card would make the nut flush
      // Ace of the suit is always the nut draw
      const isNutDraw = highestHoleSuitRank === 14 ||
        (highestHoleSuitRank > highestBoardSuitRank &&
         !boardSuitRanks.includes(14)); // Ace not on board in that suit

      return { hasFlushDraw: true, isNutDraw };
    }
  }

  return { hasFlushDraw: false, isNutDraw: false };
}

function detectFlushSuit(communityCards: Card[]): string | null {
  const suitCounts = new Map<string, number>();
  for (const c of communityCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  for (const [suit, count] of suitCounts) {
    if (count >= 3) return suit;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Straight draw helpers
// ---------------------------------------------------------------------------

function detectStraightDraws(
  holeCards: [Card, Card],
  communityCards: Card[],
): { oesd: boolean; gutshot: boolean } {
  // We need at least one hole card to contribute to the straight draw
  const allRanks: number[] = [...holeCards, ...communityCards].map((c) => c.rank);
  const holeRankSet = new Set<number>(holeCards.map((c) => c.rank));
  const uniqueRanks = [...new Set(allRanks)];

  // Add Ace as low (1) for wheel draws
  const ranks: number[] = [...uniqueRanks];
  if (ranks.includes(14)) ranks.push(1);

  // Also check if the completed straight already exists (then it's made, not a draw)
  const rankSet = new Set<number>(ranks);

  let oesd = false;
  let gutshot = false;

  for (let start = 1; start <= 10; start++) {
    const window = [start, start + 1, start + 2, start + 3, start + 4];
    const present = window.filter((r) => rankSet.has(r));
    const missing = window.filter((r) => !rankSet.has(r));

    if (present.length === 5) continue; // Already a straight (made hand)

    if (present.length === 4 && missing.length === 1) {
      // Need exactly 1 card — check that at least 1 hole card is in the 4 present
      const holeContributes = present.some((r) => holeRankSet.has(r) || (r === 1 && holeRankSet.has(14)));
      if (!holeContributes) continue;

      const missingRank = missing[0]!;
      // Open-ended: missing card is at either end
      if (missingRank === window[0] || missingRank === window[4]) {
        oesd = true;
      } else {
        gutshot = true;
      }
    }
  }

  return { oesd, gutshot };
}

// ---------------------------------------------------------------------------
// Backdoor draw helpers (flop only)
// ---------------------------------------------------------------------------

function detectBackdoorFlush(
  holeCards: [Card, Card],
  communityCards: Card[],
): boolean {
  if (communityCards.length !== 3) return false;

  const allCards = [...holeCards, ...communityCards];
  const suitCounts = new Map<string, number>();
  for (const c of allCards) {
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }

  for (const [suit, count] of suitCounts) {
    // 3 to a flush with at least 1 hole card in that suit
    if (count === 3 && holeCards.some((c) => c.suit === suit)) {
      return true;
    }
  }
  return false;
}

function detectBackdoorStraight(
  holeCards: [Card, Card],
  communityCards: Card[],
): boolean {
  if (communityCards.length !== 3) return false;

  const allRanks: number[] = [...holeCards, ...communityCards].map((c) => c.rank);
  const holeRankSet = new Set<number>(holeCards.map((c) => c.rank));
  const uniqueRanks = [...new Set(allRanks)];
  const ranks: number[] = [...uniqueRanks];
  if (ranks.includes(14)) ranks.push(1);
  const rankSet = new Set<number>(ranks);

  for (let start = 1; start <= 10; start++) {
    const window = [start, start + 1, start + 2, start + 3, start + 4];
    const present = window.filter((r) => rankSet.has(r));

    // 3 of 5 present with at least 1 hole card
    if (present.length === 3) {
      const holeContributes = present.some((r) => holeRankSet.has(r) || (r === 1 && holeRankSet.has(14)));
      if (holeContributes) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Nut strength and blocker helpers
// ---------------------------------------------------------------------------

/**
 * Compute relative nut strength (0.0 = air, 1.0 = absolute nuts).
 * Based on hand category and sub-classification.
 */
function computeNutStrength(
  category: HandCategoryType,
  madeTier: MadeHandTier,
  holeRanks: [number, number],
  _boardRanks: number[],
): number {
  // Category-based base strength
  const categoryBase: Record<number, number> = {
    [HandCategory.ROYAL_FLUSH]: 1.0,
    [HandCategory.STRAIGHT_FLUSH]: 0.98,
    [HandCategory.FOUR_OF_A_KIND]: 0.95,
    [HandCategory.FULL_HOUSE]: 0.90,
    [HandCategory.FLUSH]: 0.82,
    [HandCategory.STRAIGHT]: 0.75,
    [HandCategory.THREE_OF_A_KIND]: 0.65,
    [HandCategory.TWO_PAIR]: 0.55,
    [HandCategory.ONE_PAIR]: 0.30,
    [HandCategory.HIGH_CARD]: 0.10,
  };

  let strength = categoryBase[category] ?? 0.10;

  // Refine within ONE_PAIR based on tier
  if (category === HandCategory.ONE_PAIR) {
    switch (madeTier) {
      case 1: strength = 0.45; break; // Overpair or TP strong kicker
      case 2: strength = 0.32; break; // TP weak kicker or second pair
      case 3: strength = 0.20; break; // Underpair or bottom pair
      case 4: strength = 0.10; break; // Shouldn't happen for one pair
    }
  }

  // Refine within HIGH_CARD
  if (category === HandCategory.HIGH_CARD) {
    if (holeRanks[0] === 14) strength = 0.15;
    else if (holeRanks[0] === 13) strength = 0.12;
    else strength = 0.05;
  }

  return Math.max(0, Math.min(1, strength));
}

/**
 * Detect if hole cards block opponent's likely top hands.
 * Having an Ace or King that pairs the board blocks opponent's top pair.
 */
function detectTopBlocker(
  holeRanks: [number, number],
  boardRanks: number[],
): boolean {
  const topBoardCard = boardRanks[0] ?? 0;

  // Holding an Ace when board has ace-high texture
  if (holeRanks[0] === 14 && topBoardCard < 14) return true;

  // Holding the top board card rank blocks opponent's top pair
  if (holeRanks[0] === topBoardCard || holeRanks[1] === topBoardCard) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

function findBoardPairRanks(communityCards: Card[]): Set<number> {
  const rankCounts = new Map<number, number>();
  for (const c of communityCards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }
  const paired = new Set<number>();
  for (const [rank, count] of rankCounts) {
    if (count >= 2) paired.add(rank);
  }
  return paired;
}

function countHolePairContribution(
  holeRanks: [number, number],
  boardRanks: number[],
  boardPairRanks: Set<number>,
): number {
  // Count how many hole cards form a pair with a board card (not with a board pair)
  let count = 0;
  const boardRankSet = new Set(boardRanks);
  if (boardRankSet.has(holeRanks[0]) && !boardPairRanks.has(holeRanks[0])) count++;
  if (boardRankSet.has(holeRanks[1]) && !boardPairRanks.has(holeRanks[1])) count++;
  return count;
}
