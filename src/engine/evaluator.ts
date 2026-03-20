import type { Card } from '@/types';

/**
 * Hand categories (higher value = stronger hand).
 */
export const HandCategory = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
} as const;

export type HandCategoryType = (typeof HandCategory)[keyof typeof HandCategory];

export const CATEGORY_NAMES: Record<HandCategoryType, string> = {
  [HandCategory.HIGH_CARD]: 'High Card',
  [HandCategory.ONE_PAIR]: 'One Pair',
  [HandCategory.TWO_PAIR]: 'Two Pair',
  [HandCategory.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandCategory.STRAIGHT]: 'Straight',
  [HandCategory.FLUSH]: 'Flush',
  [HandCategory.FULL_HOUSE]: 'Full House',
  [HandCategory.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HandCategory.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandCategory.ROYAL_FLUSH]: 'Royal Flush',
};

const RANK_NAMES: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six',
  7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};

const RANK_SHORT: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export interface EvaluatedHand {
  /** Hand category (higher = better) */
  category: HandCategoryType;
  /**
   * Numeric rank for direct comparison. Higher = better.
   * Encodes category + sub-ranks to enable a > b comparison.
   */
  rank: number;
  /** The best 5 cards used */
  bestFive: Card[];
  /** Human-readable description */
  description: string;
}

/**
 * Evaluate a 7-card hand (2 hole + 5 community) and return the best 5-card hand.
 * Checks all C(7,5) = 21 combinations.
 */
// @MX:ANCHOR fan_in=4 | Core 7-card hand evaluator — used by showdown, AI classifier, postflop
export function evaluate7(cards: Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`Expected 5–7 cards, got ${cards.length}`);
  }

  if (cards.length === 5) {
    return evaluate5(cards);
  }

  let best: EvaluatedHand | null = null;

  const combos = combinations(cards, 5);
  for (const combo of combos) {
    const result = evaluate5(combo);
    if (best === null || result.rank > best.rank) {
      best = result;
    }
  }

  return best!;
}

/**
 * Compare two evaluated hands.
 * Returns: -1 if a wins, 0 if tie, 1 if b wins.
 */
// @MX:ANCHOR fan_in=3 | Hand comparison for winner determination — used in showdown and pot distribution
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): -1 | 0 | 1 {
  if (a.rank > b.rank) return -1;
  if (a.rank < b.rank) return 1;
  return 0;
}

/**
 * Evaluate a 5-card hand.
 */
function evaluate5(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a); // descending
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(ranks);
  const isAceLowStraight = checkAceLowStraight(ranks);

  // Count rank occurrences
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  // Sort by count desc, then by rank desc
  const groups = [...rankCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // count desc
    return b[0] - a[0]; // rank desc
  });

  const counts = groups.map((g) => g[1]);
  const groupRanks = groups.map((g) => g[0]);

  // Determine category and build rank
  if (isFlush && isStraight) {
    const highCard = ranks[0]!;
    if (highCard === 14) {
      return makeResult(HandCategory.ROYAL_FLUSH, [14], cards, 'Royal Flush');
    }
    return makeResult(HandCategory.STRAIGHT_FLUSH, [highCard], cards,
      `Straight Flush, ${RANK_NAMES[highCard]} high`);
  }

  if (isFlush && isAceLowStraight) {
    // A-2-3-4-5 flush = straight flush, 5 high
    return makeResult(HandCategory.STRAIGHT_FLUSH, [5], cards, 'Straight Flush, Five high');
  }

  if (counts[0] === 4) {
    const quadRank = groupRanks[0]!;
    const kicker = groupRanks[1]!;
    return makeResult(HandCategory.FOUR_OF_A_KIND, [quadRank, kicker], cards,
      `Four of a Kind, ${RANK_NAMES[quadRank]}s`);
  }

  if (counts[0] === 3 && counts[1] === 2) {
    const tripRank = groupRanks[0]!;
    const pairRank = groupRanks[1]!;
    return makeResult(HandCategory.FULL_HOUSE, [tripRank, pairRank], cards,
      `Full House, ${RANK_NAMES[tripRank]}s full of ${RANK_NAMES[pairRank]}s`);
  }

  if (isFlush) {
    return makeResult(HandCategory.FLUSH, ranks, cards,
      `Flush, ${RANK_NAMES[ranks[0]!]} high`);
  }

  if (isStraight) {
    const highCard = ranks[0]!;
    return makeResult(HandCategory.STRAIGHT, [highCard], cards,
      `Straight, ${RANK_NAMES[highCard]} high`);
  }

  if (isAceLowStraight) {
    return makeResult(HandCategory.STRAIGHT, [5], cards, 'Straight, Five high');
  }

  if (counts[0] === 3) {
    const tripRank = groupRanks[0]!;
    const kickers = groupRanks.slice(1);
    return makeResult(HandCategory.THREE_OF_A_KIND, [tripRank, ...kickers], cards,
      `Three of a Kind, ${RANK_NAMES[tripRank]}s`);
  }

  if (counts[0] === 2 && counts[1] === 2) {
    const highPair = Math.max(groupRanks[0]!, groupRanks[1]!);
    const lowPair = Math.min(groupRanks[0]!, groupRanks[1]!);
    const kicker = groupRanks[2]!;
    return makeResult(HandCategory.TWO_PAIR, [highPair, lowPair, kicker], cards,
      `Two Pair, ${RANK_NAMES[highPair]}s and ${RANK_NAMES[lowPair]}s`);
  }

  if (counts[0] === 2) {
    const pairRank = groupRanks[0]!;
    const kickers = groupRanks.slice(1);
    return makeResult(HandCategory.ONE_PAIR, [pairRank, ...kickers], cards,
      `Pair of ${RANK_NAMES[pairRank]}s, ${RANK_SHORT[kickers[0]!]} kicker`);
  }

  // High card
  return makeResult(HandCategory.HIGH_CARD, ranks, cards,
    `High Card, ${RANK_NAMES[ranks[0]!]}`);
}

/**
 * Build an EvaluatedHand result with a numeric rank for comparison.
 * The rank encodes: category (top bits) + sub-ranks (lower bits).
 * Each sub-rank uses 4 bits (enough for rank 2-14).
 */
function makeResult(
  category: HandCategoryType,
  subRanks: number[],
  cards: Card[],
  description: string,
): EvaluatedHand {
  // Encode rank: category * 15^5 + subRanks[0]*15^4 + subRanks[1]*15^3 + ...
  let rank = category * (15 ** 5);
  for (let i = 0; i < subRanks.length && i < 5; i++) {
    rank += subRanks[i]! * (15 ** (4 - i));
  }

  return { category, rank, bestFive: [...cards], description };
}

/**
 * Check if sorted (desc) ranks form a straight (e.g., [14,13,12,11,10]).
 */
function checkStraight(sortedDesc: number[]): boolean {
  for (let i = 0; i < sortedDesc.length - 1; i++) {
    if (sortedDesc[i]! - sortedDesc[i + 1]! !== 1) return false;
  }
  return true;
}

/**
 * Check for Ace-low straight (A-2-3-4-5).
 * Sorted desc: [14, 5, 4, 3, 2]
 */
function checkAceLowStraight(sortedDesc: number[]): boolean {
  return (
    sortedDesc[0] === 14 &&
    sortedDesc[1] === 5 &&
    sortedDesc[2] === 4 &&
    sortedDesc[3] === 3 &&
    sortedDesc[4] === 2
  );
}

/**
 * Generate all k-element combinations from an array.
 */
function combinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];

  function helper(start: number, combo: T[]): void {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]!);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}
