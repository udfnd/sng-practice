import type { Card } from '@/types';

/**
 * Calculate Stack-to-Pot Ratio.
 * SPR = effective stack / pot size
 */
export function calculateSPR(effectiveStack: number, potSize: number): number {
  if (potSize === 0) return Infinity;
  return effectiveStack / potSize;
}

/**
 * Get recommended bet size as fraction of pot based on SPR.
 *
 * SPR < 3:  1.0+ (overbet or all-in commitment)
 * SPR 3-6:  0.66-1.0
 * SPR 6-10: 0.33-0.66
 * SPR > 10: 0.25-0.33
 */
export function sprBetSizing(spr: number): number {
  if (spr < 1) return 1.25;      // Extreme short stack: overbet
  if (spr < 3) return 1.0;       // Short stack: pot-size or overbet
  if (spr < 6) return 0.75;      // Medium-low SPR: 3/4 pot
  if (spr < 10) return 0.50;     // Medium SPR: half pot
  return 0.33;                    // Deep stack: 1/3 pot
}

/**
 * Range advantage score: how much the board favors the aggressor's range.
 *
 * Returns -1.0 to +1.0 where:
 *   +1.0 = board strongly favors aggressor (e.g., A-K-2 rainbow)
 *    0.0 = neutral
 *   -1.0 = board strongly favors caller (e.g., 7-8-9 two-tone)
 *
 * High cards favor aggressor (raiser's range is top-heavy):
 *   Board has A: +0.30
 *   Board has K: +0.30
 *   Board has Q: +0.15
 *   Board has J or T: +0.05
 *
 * Low/connected cards favor caller:
 *   3+ cards within 4 ranks (connected): -0.30
 *   2+ cards of same suit (flush draw present): -0.15
 *   Paired board: -0.10
 */
export function rangeAdvantageScore(
  communityCards: Card[],
  isAggressor: boolean,
): number {
  const ranks = communityCards.map((c) => c.rank);
  const suits = communityCards.map((c) => c.suit);

  let score = 0;

  // High cards favor aggressor (count unique ranks only)
  const uniqueRanks = [...new Set(ranks)];
  for (const rank of uniqueRanks) {
    if (rank === 14) score += 0.30;       // Ace
    else if (rank === 13) score += 0.30;  // King
    else if (rank === 12) score += 0.15;  // Queen
    else if (rank === 11 || rank === 10) score += 0.05; // Jack or Ten
  }

  // Connected board favors caller
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  let connectedCount = 0;
  for (let i = 0; i < sortedRanks.length - 1; i++) {
    const gap = sortedRanks[i + 1]! - sortedRanks[i]!;
    if (gap <= 4) connectedCount++;
  }
  if (connectedCount >= 2) score -= 0.30;

  // Flush draw on board favors caller
  const suitCounts = new Map<string, number>();
  for (const suit of suits) {
    suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1);
  }
  const maxSuitCount = Math.max(...suitCounts.values());
  if (maxSuitCount >= 2) score -= 0.15;

  // Paired board reduces advantage slightly (more neutral)
  const rankCounts = new Map<number, number>();
  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  }
  if ([...rankCounts.values()].some((c) => c >= 2)) score -= 0.10;

  // Clamp to [-1, 1]
  score = Math.max(-1, Math.min(1, score));

  // If not aggressor, negate the score (caller's perspective)
  return isAggressor ? score : -score;
}

/**
 * Multiway penalty: reduce c-bet frequency as opponents increase.
 * Returns a multiplier (0.0-1.0) to apply to c-bet frequency.
 *
 * 1 opponent:  1.0 (no penalty)
 * 2 opponents: 0.65
 * 3+ opponents: 0.40
 */
export function multiwayPenalty(opponents: number): number {
  if (opponents <= 1) return 1.0;
  if (opponents === 2) return 0.65;
  return 0.40;
}
