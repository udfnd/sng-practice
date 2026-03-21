import type { Card } from '@/types';

export type BoardTexture = 'dry' | 'wet' | 'monotone' | 'paired';

/**
 * Detailed board texture analysis result.
 * The `category` field maintains backward compatibility with the old string return type.
 */
export interface BoardTextureDetail {
  /** Primary texture category — backward-compatible with old BoardTexture string */
  category: BoardTexture;
  /** True when 3+ cards of the same suit are on board (flush already possible) */
  flushComplete: boolean;
  /** True when 3+ cards in sequence appear on the board (straight already possible) */
  straightComplete: boolean;
  /** Number of Broadway cards (J, Q, K, A — rank >= 11) on the board */
  highCardCount: number;
  /** Number of distinct ranks that are paired (appear 2+ times) */
  pairedCount: number;
  /** Highest number of cards sharing the same suit */
  maxSuitCount: number;
  /** 0–1 score of how connected the board is */
  connectivity: number;
}

/**
 * Analyze board texture from community cards.
 * Returns a BoardTextureDetail object. Use `.category` for backward compatibility.
 */
export function analyzeBoardTexture(communityCards: Card[]): BoardTextureDetail {
  if (communityCards.length < 3) {
    return {
      category: 'dry',
      flushComplete: false,
      straightComplete: false,
      highCardCount: 0,
      pairedCount: 0,
      maxSuitCount: communityCards.length > 0 ? 1 : 0,
      connectivity: 0,
    };
  }

  const suits = communityCards.map((c) => c.suit);
  const ranks = communityCards.map((c) => c.rank);

  // --- Suit analysis ---
  const suitCounts = new Map<string, number>();
  for (const s of suits) {
    suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  }
  const maxSuitCount = Math.max(...suitCounts.values());
  const flushComplete = maxSuitCount >= 3;

  // --- Rank analysis ---
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }
  const pairedCount = [...rankCounts.values()].filter((c) => c >= 2).length;

  // --- High card count (J+ = rank >= 11) ---
  const uniqueRanks = [...new Set(ranks)];
  const highCardCount = uniqueRanks.filter((r) => r >= 11).length;

  // --- Straight completeness ---
  // Board completes a straight if 3+ sequential ranks appear in a window of 5
  const sortedRanks = [...uniqueRanks].sort((a, b) => a - b);
  // Add low Ace for wheel detection
  const extendedRanks = sortedRanks.includes(14) ? [1, ...sortedRanks] : sortedRanks;
  let straightComplete = false;
  for (let start = 1; start <= 10; start++) {
    const window = [start, start + 1, start + 2, start + 3, start + 4];
    const count = window.filter((r) => extendedRanks.includes(r)).length;
    if (count >= 3) {
      straightComplete = true;
      break;
    }
  }

  // --- Connectivity score (0–1) ---
  // Measures how connected the board cards are to each other.
  // Based on consecutive gaps between sorted ranks: gap <= 1 → 1.0, gap <= 2 → 0.5, else 0.
  const sorted = [...ranks].sort((a, b) => a - b);
  let connScore = 0;
  let slots = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1]! - sorted[i]!;
    if (gap === 0) {
      connScore += 0.5; // paired cards — moderate connectivity
    } else if (gap === 1) {
      connScore += 1.0; // directly connected
    } else if (gap === 2) {
      connScore += 0.5; // one-gap
    }
    // gap > 2 contributes 0
    slots++;
  }
  const connectivity = slots > 0 ? Math.min(1, connScore / slots) : 0;

  // --- Category determination ---
  let category: BoardTexture;

  if (flushComplete) {
    category = 'monotone';
  } else if (pairedCount > 0) {
    category = 'paired';
  } else {
    // Check connectivity: wet vs dry
    // Original logic: connections based on gap <= 2 between consecutive sorted ranks
    const consecutive = [...ranks].sort((a, b) => a - b);
    let connections = 0;
    for (let i = 0; i < consecutive.length - 1; i++) {
      const gap = consecutive[i + 1]! - consecutive[i]!;
      if (gap <= 2) connections++;
    }
    const hasFlushDraw = maxSuitCount >= 2;

    if (connections >= 2 || (connections >= 1 && hasFlushDraw)) {
      category = 'wet';
    } else {
      category = 'dry';
    }
  }

  return {
    category,
    flushComplete,
    straightComplete,
    highCardCount,
    pairedCount,
    maxSuitCount,
    connectivity,
  };
}

/**
 * Get C-bet frequency adjustment based on board texture category.
 */
export function textureAdjustment(texture: BoardTexture): number {
  switch (texture) {
    case 'dry': return 0.12;     // +12% C-bet on dry boards
    case 'wet': return -0.12;    // -12% on wet boards
    case 'monotone': return -0.10;
    case 'paired': return 0.05;  // Slight increase on paired
  }
}
