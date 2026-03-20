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
 * Determine showdown reveal order per TDA rules.
 *
 * 1. All-in players: revealed immediately
 * 2. Last aggressor reveals first
 * 3. If no aggressor (check-through): first-to-act reveals first
 * 4. AI always shows (learning UX exception)
 */
// @MX:WARN @MX:REASON="3-level sort: all-in > aggressor > action order" | TDA-compliant reveal ordering
export function getShowdownOrder(
  players: Player[],
  communityCards: Card[],
  lastAggressorId: string | null,
  actionOrderIds: string[],
): ShowdownReveal[] {
  const eligible = players.filter((p) => p.isActive && !p.isFolded && p.holeCards);

  const reveals: ShowdownReveal[] = [];

  // Evaluate each player's hand
  for (const p of eligible) {
    const allCards = [...p.holeCards!, ...communityCards];
    const hand = evaluate7(allCards);
    reveals.push({
      playerId: p.id,
      cards: p.holeCards!,
      hand,
    });
  }

  // Sort by reveal order
  reveals.sort((a, b) => {
    // All-in players first
    const aAllIn = players.find((p) => p.id === a.playerId)!.isAllIn;
    const bAllIn = players.find((p) => p.id === b.playerId)!.isAllIn;
    if (aAllIn && !bAllIn) return -1;
    if (!aAllIn && bAllIn) return 1;

    // Last aggressor next
    if (a.playerId === lastAggressorId) return -1;
    if (b.playerId === lastAggressorId) return 1;

    // Otherwise by action order (first to act first)
    const aIdx = actionOrderIds.indexOf(a.playerId);
    const bIdx = actionOrderIds.indexOf(b.playerId);
    return aIdx - bIdx;
  });

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
