import type { Player, Card } from '@/types';
import { evaluate7, compareHands, type EvaluatedHand } from './evaluator';

export interface ShowdownReveal {
  playerId: string;
  cards: [Card, Card];
  hand: EvaluatedHand;
}

export interface ShowdownResult {
  /** Reveals in showdown order */
  reveals: ShowdownReveal[];
  /** Winners per pot (indices into reveals) */
  winners: string[];
}

/**
 * Evaluate hands for all eligible (non-folded, active) players.
 * This is the pure evaluation step — no ordering logic.
 */
function evaluateHands(
  players: Player[],
  communityCards: Card[],
): ShowdownReveal[] {
  const eligible = players.filter((p) => p.isActive && !p.isFolded && p.holeCards);
  return eligible.map((p) => {
    const allCards = [...p.holeCards!, ...communityCards];
    const hand = evaluate7(allCards);
    return { playerId: p.id, cards: p.holeCards!, hand };
  });
}

/**
 * Determine showdown reveal order per TDA rules.
 *
 * Two distinct modes:
 * 1. All-in showdown: all live hands are tabled simultaneously (no ordering needed for rules,
 *    but we sort all-in players first for consistent UI presentation)
 * 2. Non-all-in showdown: last aggressor first, then clockwise from button
 *
 * @param players All players in the hand
 * @param communityCards Board cards
 * @param lastAggressorId Last player who bet/raised on the final street (null if checked through)
 * @param actionOrderIds Player IDs in clockwise action order from button
 */
export function getShowdownOrder(
  players: Player[],
  communityCards: Card[],
  lastAggressorId: string | null,
  actionOrderIds: string[],
): ShowdownReveal[] {
  const reveals = evaluateHands(players, communityCards);
  if (reveals.length === 0) return reveals;

  // Determine if this is an all-in showdown
  const nonFolded = players.filter((p) => p.isActive && !p.isFolded);
  const isAllInShowdown = nonFolded.some((p) => p.isAllIn);

  if (isAllInShowdown) {
    // All-in showdown: all hands are tabled (TDA). Sort all-in first for UI consistency.
    reveals.sort((a, b) => {
      const aAllIn = players.find((p) => p.id === a.playerId)!.isAllIn;
      const bAllIn = players.find((p) => p.id === b.playerId)!.isAllIn;
      if (aAllIn && !bAllIn) return -1;
      if (!aAllIn && bAllIn) return 1;
      return actionOrderIds.indexOf(a.playerId) - actionOrderIds.indexOf(b.playerId);
    });
  } else {
    // Non-all-in showdown: last aggressor first, then clockwise from button
    reveals.sort((a, b) => {
      if (a.playerId === lastAggressorId) return -1;
      if (b.playerId === lastAggressorId) return 1;
      return actionOrderIds.indexOf(a.playerId) - actionOrderIds.indexOf(b.playerId);
    });
  }

  return reveals;
}

/**
 * Determine winners from showdown reveals.
 * Returns player IDs of the winner(s) (may be tied).
 */
export function determineWinners(reveals: ShowdownReveal[]): string[] {
  if (reveals.length === 0) return [];
  if (reveals.length === 1) return [reveals[0]!.playerId];

  let best = reveals[0]!;
  let winners = [best.playerId];

  for (let i = 1; i < reveals.length; i++) {
    const current = reveals[i]!;
    const cmp = compareHands(current.hand, best.hand);

    if (cmp === -1) {
      // Current wins
      best = current;
      winners = [current.playerId];
    } else if (cmp === 0) {
      // Tie
      winners.push(current.playerId);
    }
  }

  return winners;
}
