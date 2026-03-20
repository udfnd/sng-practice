import type { BettingRoundState, GameState } from '@/types';
import { isBettingComplete } from './betting';
import type { BettingPlayer } from './betting';

/**
 * Result of computing valid actions for a player.
 */
export interface ValidActionsResult {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  /** Amount needed to call (0 if no call available) */
  callAmount: number;
  /** Minimum bet amount (0 if no bet available) */
  minBet: number;
  /** Maximum bet amount = player's total chips (all-in) */
  maxBet: number;
  /** Minimum raise-to total (0 if no raise available) */
  minRaise: number;
  /** Maximum raise-to total = player.currentBet + player.chips */
  maxRaise: number;
}

/**
 * Determine the full action order for the current street.
 *
 * Preflop:
 *   - 2 players (HU): SB first
 *   - 3+ players: UTG (left of BB) first, BB last (has option)
 *
 * Postflop:
 *   - 2 players (HU): BB first
 *   - 3+ players: first active player left of button, clockwise
 *
 * @param state Partial GameState containing players, seatIndices, and bettingRound
 * @returns Array of active player IDs in action order
 */
// @MX:NOTE | Preflop: UTG first (left of BB). Postflop: first left of button. HU exception applies.
export function getActionOrder(
  state: Pick<GameState, 'players' | 'buttonSeatIndex' | 'sbSeatIndex' | 'bbSeatIndex' | 'bettingRound'>,
): string[] {
  const activePlayers = state.players.filter((p) => p.isActive);
  const isPreflop = state.bettingRound.street === 'PREFLOP';
  const isHU = activePlayers.length === 2;

  // Get sorted seat indices of active players
  const activeSeats = activePlayers
    .map((p) => ({ id: p.id, seat: p.seatIndex }))
    .sort((a, b) => a.seat - b.seat);

  if (isHU) {
    // HU special rules
    const sbPlayer = activePlayers.find((p) => p.seatIndex === state.sbSeatIndex)!;
    const bbPlayer = activePlayers.find((p) => p.seatIndex === state.bbSeatIndex)!;

    if (isPreflop) {
      // HU preflop: SB (= button) acts first
      return [sbPlayer.id, bbPlayer.id];
    } else {
      // HU postflop: BB acts first
      return [bbPlayer.id, sbPlayer.id];
    }
  }

  if (isPreflop) {
    // Multiway preflop: UTG (left of BB) first, ending with BB
    const bbSeat = state.bbSeatIndex;
    const bbIdx = activeSeats.findIndex((p) => p.seat === bbSeat);

    // Order: start from left of BB (UTG), wrap around, end at BB
    const order: string[] = [];
    for (let i = 1; i <= activeSeats.length; i++) {
      const idx = (bbIdx + i) % activeSeats.length;
      order.push(activeSeats[idx]!.id);
    }
    return order;
  } else {
    // Multiway postflop: first active player left of button, button last
    const btnSeat = state.buttonSeatIndex;
    const btnIdx = activeSeats.findIndex((p) => p.seat === btnSeat);

    // Order: start from left of button (SB), wrap around, end at button
    const order: string[] = [];
    for (let i = 1; i <= activeSeats.length; i++) {
      const idx = (btnIdx + i) % activeSeats.length;
      order.push(activeSeats[idx]!.id);
    }
    return order;
  }
}

/**
 * Find the next player who should act after the current player.
 *
 * Scans clockwise from currentPlayerId in the actionOrder.
 * Skips folded and all-in players.
 * Returns null if betting is complete or no eligible player found.
 *
 * @param actionOrder Array of player IDs in action order
 * @param bettingPlayers Current betting player states
 * @param bettingRound Current betting round state
 * @param currentPlayerId The player who just acted (or null for first player)
 * @returns Next player's ID, or null if betting is complete
 */
// @MX:NOTE | Returns null when isBettingComplete or only folded/all-in players remain
export function getNextPlayer(
  actionOrder: string[],
  bettingPlayers: BettingPlayer[],
  bettingRound: BettingRoundState,
  currentPlayerId: string | null,
): string | null {
  // Check if betting is already complete
  if (isBettingComplete(bettingPlayers, bettingRound)) {
    return null;
  }

  // Find remaining non-folded, non-all-in players
  const eligible = bettingPlayers.filter((p) => !p.isFolded && !p.isAllIn);

  // No one left to act
  if (eligible.length === 0) return null;

  // If only one non-folded player (fold-win scenario)
  const nonFolded = bettingPlayers.filter((p) => !p.isFolded);
  if (nonFolded.length <= 1) return null;

  if (currentPlayerId === null) {
    // Return first eligible in order
    for (const id of actionOrder) {
      if (eligible.some((p) => p.id === id)) {
        return id;
      }
    }
    return null;
  }

  // Find current player's position in action order
  const currentIdx = actionOrder.indexOf(currentPlayerId);
  if (currentIdx === -1) {
    // Fall back to first eligible
    for (const id of actionOrder) {
      if (eligible.some((p) => p.id === id)) {
        return id;
      }
    }
    return null;
  }

  // Scan clockwise from current player
  const len = actionOrder.length;
  for (let i = 1; i <= len; i++) {
    const nextIdx = (currentIdx + i) % len;
    const nextId = actionOrder[nextIdx]!;
    const nextPlayer = bettingPlayers.find((p) => p.id === nextId);

    if (nextPlayer && !nextPlayer.isFolded && !nextPlayer.isAllIn) {
      return nextId;
    }
  }

  return null;
}

/**
 * Compute valid actions for a player in the current betting round.
 *
 * @param player Current player state
 * @param bettingRound Current betting round state
 * @param bb Big blind amount (used for minimum bet sizing)
 * @returns ValidActionsResult describing what actions are available
 */
// @MX:NOTE | canRaise is true even for short all-in below min-raise (all-in is always permitted)
export function getValidActions(
  player: BettingPlayer,
  bettingRound: BettingRoundState,
  _bb: number,
): ValidActionsResult {
  const facingBet = bettingRound.currentBet;
  const playerBet = player.currentBet;
  const stack = player.chips;
  const totalPlayerCommitment = playerBet + stack; // max they can commit total

  // Can always fold (unless no bet to fold to, but still allowed)
  const canFold = true;

  // Can check: only when no additional amount needed
  const canCheck = playerBet >= facingBet;

  // Can call: when there is a bet larger than player's current bet
  const canCall = facingBet > playerBet;

  // Can bet: only when no current bet on this street
  const canBet = facingBet === 0;

  // Can raise: when there is a current bet (and player has chips)
  const canRaise = facingBet > 0 && stack > 0;

  // Call amount calculation
  let callAmount = 0;
  if (canCall) {
    callAmount = Math.min(facingBet - playerBet, stack);
  }

  // Bet range
  let minBet = 0;
  let maxBet = 0;
  if (canBet) {
    minBet = Math.min(bettingRound.lastFullRaiseSize, stack); // min bet = BB (or all-in)
    maxBet = stack;
  }

  // Raise range
  let minRaise = 0;
  let maxRaise = 0;
  if (canRaise) {
    const minRaiseTo = facingBet + bettingRound.lastFullRaiseSize;
    minRaise = Math.min(minRaiseTo, totalPlayerCommitment); // cap at all-in
    maxRaise = totalPlayerCommitment; // all-in
  }

  return {
    canFold,
    canCheck,
    canCall,
    canBet,
    canRaise,
    callAmount,
    minBet,
    maxBet,
    minRaise,
    maxRaise,
  };
}
