import type { Card } from '@/types';
import { analyzeBoardTexture } from './board-texture';

/**
 * Board cluster categories for strategy lookup.
 * Boards within the same cluster have similar strategic properties
 * (range advantage, nut advantage, c-bet sizing tendencies).
 *
 * 12 flop clusters, 6 turn clusters, 5 river clusters.
 */
export type FlopCluster =
  | 'Ahi_dry'           // A-x-x rainbow, disconnected (raiser advantage)
  | 'Ahi_wet'           // A-x-x with flush draw or connected
  | 'Khi_dry'           // K-high dry (strong raiser advantage)
  | 'broadway_conn'     // Two+ broadway cards connected (KQJ, QJT)
  | 'mid_dynamic'       // Mid cards (7-T), connected or 2-tone
  | 'mid_dry'           // Mid cards, rainbow disconnected
  | 'low_conn_2tone'    // Low cards (2-8), connected, 2-tone (caller advantage)
  | 'low_dry'           // Low cards, rainbow disconnected
  | 'paired_high'       // Board has high pair (T+)
  | 'paired_low'        // Board has low pair (<T)
  | 'monotone'          // 3 cards same suit
  | 'wheel_Alow';       // A with low cards (A-2-5 type, wheel territory)

export type TurnCluster =
  | 'blank'             // Turn doesn't change board texture significantly
  | 'flush_complete'    // 4th suit card, flush now possible
  | 'straight_complete' // Connecting card completes straight possibilities
  | 'overcard'          // Turn brings highest card
  | 'pair_board'        // Turn pairs the board
  | 'brick_low';        // Low card that doesn't connect

export type RiverCluster =
  | 'blank'             // River doesn't change much
  | 'flush_complete'    // Flush completes on river
  | 'straight_complete' // Straight completes on river
  | 'pair_board'        // Board pairs on river
  | 'scare_card';       // Overcard or completing card

/**
 * Classify a flop into a strategic cluster.
 */
export function classifyFlopCluster(communityCards: Card[]): FlopCluster {
  if (communityCards.length < 3) return 'mid_dry';

  const flop = communityCards.slice(0, 3);
  const ranks = flop.map((c) => c.rank).sort((a, b) => b - a);
  const suits = flop.map((c) => c.suit);
  const detail = analyzeBoardTexture(flop);

  const [high, mid, low] = ranks;
  const hasAce = high === 14;
  const hasKing = high === 13;
  const highestIsBroadway = high! >= 11; // J+

  // Suit analysis
  const isMonotone = detail.maxSuitCount >= 3;
  const isTwoTone = detail.maxSuitCount === 2;
  const isRainbow = detail.maxSuitCount === 1;

  // Connectivity
  const gap1 = high! - mid!;
  const gap2 = mid! - low!;
  const isConnected = gap1 <= 2 && gap2 <= 2;
  const isSemiConnected = gap1 <= 3 || gap2 <= 3;

  // Paired board
  if (detail.pairedCount > 0) {
    return high! >= 10 ? 'paired_high' : 'paired_low';
  }

  // Monotone
  if (isMonotone) {
    return 'monotone';
  }

  // Ace-low (wheel territory): A with 2 low cards
  if (hasAce && mid! <= 5) {
    return 'wheel_Alow';
  }

  // Ace-high boards
  if (hasAce) {
    if (isTwoTone || isConnected) return 'Ahi_wet';
    return 'Ahi_dry';
  }

  // King-high dry
  if (hasKing && isRainbow && !isConnected) {
    return 'Khi_dry';
  }

  // Broadway connected (2+ cards >= J, connected)
  const broadwayCount = ranks.filter((r) => r! >= 11).length;
  if (broadwayCount >= 2 && isSemiConnected) {
    return 'broadway_conn';
  }

  // King-high with some connectivity = treat as mid dynamic
  if (hasKing) {
    return isTwoTone || isConnected ? 'mid_dynamic' : 'Khi_dry';
  }

  // Mid cards (7-T range)
  const isMid = high! >= 7 && high! <= 12;
  if (isMid) {
    if (isTwoTone || isConnected) return 'mid_dynamic';
    return 'mid_dry';
  }

  // Low cards
  if (isTwoTone || isConnected) return 'low_conn_2tone';
  return 'low_dry';
}

/**
 * Classify the turn card's impact on the board.
 */
export function classifyTurnCluster(communityCards: Card[]): TurnCluster {
  if (communityCards.length < 4) return 'blank';

  const flopCards = communityCards.slice(0, 3);
  const turnCard = communityCards[3]!;
  const flopDetail = analyzeBoardTexture(flopCards);
  const fullDetail = analyzeBoardTexture(communityCards.slice(0, 4));

  // Flush completing
  if (!flopDetail.flushComplete && fullDetail.maxSuitCount >= 3) {
    // 3rd suited card appeared (not complete flush, but flush draw now very live)
    if (fullDetail.maxSuitCount >= 4) return 'flush_complete';
  }

  // Board pairs
  const flopRanks = new Set(flopCards.map((c) => c.rank));
  if (flopRanks.has(turnCard.rank)) return 'pair_board';

  // Overcard
  const flopHigh = Math.max(...flopCards.map((c) => c.rank));
  if (turnCard.rank > flopHigh) return 'overcard';

  // Straight completing
  if (!flopDetail.straightComplete && fullDetail.straightComplete) {
    return 'straight_complete';
  }

  // Low brick
  if (turnCard.rank < 7) return 'brick_low';

  return 'blank';
}

/**
 * Classify the river card's impact.
 */
export function classifyRiverCluster(communityCards: Card[]): RiverCluster {
  if (communityCards.length < 5) return 'blank';

  const turnBoard = communityCards.slice(0, 4);
  const riverCard = communityCards[4]!;
  const turnDetail = analyzeBoardTexture(turnBoard);
  const fullDetail = analyzeBoardTexture(communityCards);

  // Flush completing
  if (turnDetail.maxSuitCount <= 3 && fullDetail.maxSuitCount >= 4) {
    return 'flush_complete';
  }
  // Also check if the flush was already possible but river adds another
  if (!turnDetail.flushComplete && fullDetail.flushComplete) {
    return 'flush_complete';
  }

  // Board pairs
  const turnRanks = new Set(turnBoard.map((c) => c.rank));
  if (turnRanks.has(riverCard.rank)) return 'pair_board';

  // Straight completing
  if (!turnDetail.straightComplete && fullDetail.straightComplete) {
    return 'straight_complete';
  }

  // Overcard / scare card
  const turnHigh = Math.max(...turnBoard.map((c) => c.rank));
  if (riverCard.rank > turnHigh || riverCard.rank >= 11) {
    return 'scare_card';
  }

  return 'blank';
}

/**
 * Get the overall board cluster string for strategy key lookup.
 * Combines flop cluster with turn/river modifiers.
 */
export function getBoardCluster(communityCards: Card[]): string {
  const flopCluster = classifyFlopCluster(communityCards);

  if (communityCards.length <= 3) return flopCluster;

  const turnCluster = classifyTurnCluster(communityCards);
  if (communityCards.length === 4) return `${flopCluster}|${turnCluster}`;

  const riverCluster = classifyRiverCluster(communityCards);
  return `${flopCluster}|${turnCluster}|${riverCluster}`;
}
