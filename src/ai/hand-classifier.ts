import type { Card } from '@/types';

/** Made hand strength tiers (higher = stronger) */
export type MadeHandTier = 1 | 2 | 3 | 4;

/** Draw strength tiers (higher = stronger) */
export type DrawTier = 0 | 1 | 2 | 3 | 4;

export interface HandClassification {
  madeTier: MadeHandTier;
  drawTier: DrawTier;
  madeDescription: string;
  drawDescription: string;
}

/**
 * Classify a hand's made strength and draw potential.
 */
export function classifyHand(
  holeCards: [Card, Card],
  communityCards: Card[],
): HandClassification {
  const allCards = [...holeCards, ...communityCards];
  const boardRanks = communityCards.map((c) => c.rank).sort((a, b) => b - a);
  const holeRanks = [holeCards[0].rank, holeCards[1].rank].sort((a, b) => b - a) as [number, number];

  const madeTier = classifyMadeHand(holeRanks, boardRanks);
  const drawTier = classifyDraws(allCards, holeCards);

  return {
    madeTier: madeTier.tier,
    drawTier: drawTier.tier,
    madeDescription: madeTier.description,
    drawDescription: drawTier.description,
  };
}

function classifyMadeHand(
  holeRanks: [number, number],
  boardRanks: number[],
): { tier: MadeHandTier; description: string } {
  const [high, low] = holeRanks;
  const topBoardCard = boardRanks[0] ?? 0;
  const secondBoardCard = boardRanks[1] ?? 0;

  // Check for overpair
  if (high === low && high > topBoardCard) {
    return { tier: 1, description: 'Overpair' };
  }

  // Check for top pair
  if (high === topBoardCard || low === topBoardCard) {
    const kicker = high === topBoardCard ? low : high;
    // Strong kicker = 10+ or Ace
    if (kicker >= 10) {
      return { tier: 1, description: 'Top pair, strong kicker' };
    }
    return { tier: 2, description: 'Top pair, weak kicker' };
  }

  // Check for second pair
  if (high === secondBoardCard || low === secondBoardCard) {
    return { tier: 2, description: 'Second pair' };
  }

  // Check for pocket pair (underpair)
  if (high === low) {
    return { tier: 3, description: 'Underpair' };
  }

  // Check for bottom pair
  for (const br of boardRanks.slice(2)) {
    if (high === br || low === br) {
      return { tier: 3, description: 'Bottom pair' };
    }
  }

  // Ace high
  if (high === 14) {
    return { tier: 3, description: 'Ace high' };
  }

  // Nothing
  return { tier: 4, description: 'No pair, no draw' };
}

function classifyDraws(
  allCards: Card[],
  holeCards: [Card, Card],
): { tier: DrawTier; description: string } {
  const suits = allCards.map((c) => c.suit);
  const ranks = allCards.map((c) => c.rank);

  // Count suits
  const suitCounts = new Map<string, number>();
  for (const s of suits) {
    suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  }

  // Check flush draw (4 to a flush with at least one hole card)
  let hasFlushDraw = false;
  for (const [suit, count] of suitCounts) {
    if (count >= 4 && holeCards.some((c) => c.suit === suit)) {
      hasFlushDraw = true;
    }
  }

  // Check straight draws
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
  const straightInfo = checkStraightDraws(uniqueRanks);

  // Combo draw (pair + draw or flush + straight)
  const hasPair = holeCards[0].rank === holeCards[1].rank ||
    ranks.filter((r) => r === holeCards[0].rank).length >= 2 ||
    ranks.filter((r) => r === holeCards[1].rank).length >= 2;

  if (hasFlushDraw && straightInfo.oesd) {
    return { tier: 1, description: 'Combo draw (flush + straight)' };
  }
  if (hasPair && (hasFlushDraw || straightInfo.oesd)) {
    return { tier: 1, description: 'Combo draw (pair + draw)' };
  }
  if (hasFlushDraw) {
    return { tier: 2, description: 'Flush draw' };
  }
  if (straightInfo.oesd) {
    return { tier: 3, description: 'Open-ended straight draw' };
  }
  if (straightInfo.gutshot) {
    return { tier: 4, description: 'Gutshot' };
  }

  return { tier: 0, description: 'No draw' };
}

function checkStraightDraws(uniqueRanks: number[]): { oesd: boolean; gutshot: boolean } {
  // Add Ace as low (1) for wheel draws
  const ranks = [...uniqueRanks];
  if (ranks.includes(14)) ranks.unshift(1);

  let oesd = false;
  let gutshot = false;

  // Check all windows of 5
  for (let start = 1; start <= 10; start++) {
    const window = [start, start + 1, start + 2, start + 3, start + 4];
    const count = window.filter((r) => ranks.includes(r)).length;
    if (count === 4) {
      // 4 of 5 consecutive — check if open-ended or gutshot
      const missing = window.find((r) => !ranks.includes(r))!;
      if (missing === window[0] || missing === window[4]) {
        oesd = true; // open-ended
      } else {
        gutshot = true;
      }
    }
  }

  return { oesd, gutshot };
}
