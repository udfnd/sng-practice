import type { ActionType, Street, BettingRoundState } from '@/types';

/**
 * Minimal player state needed by the betting round.
 */
export interface BettingPlayer {
  id: string;
  chips: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
}

/**
 * Result of validating and applying a player action.
 */
export interface ActionResult {
  type: ActionType;
  amount: number;
  raiseIncrement: number;
  isAllIn: boolean;
}

/**
 * Create a fresh BettingRoundState for a new street.
 */
// @MX:ANCHOR fan_in=3 | Fresh betting round for new street — used by state machine for FLOP/TURN/RIVER
export function createBettingRound(street: Street, bb: number): BettingRoundState {
  return {
    street,
    currentBet: 0,
    lastFullRaiseSize: bb,
    lastAggressorId: null,
    actedPlayerIds: [],
    playerLastFacedBet: {},
  };
}

/**
 * Create a preflop BettingRoundState after blinds are posted.
 */
export function createPreflopBettingRound(
  bb: number,
): BettingRoundState {
  return {
    street: 'PREFLOP',
    currentBet: bb,
    lastFullRaiseSize: bb,
    lastAggressorId: null,
    actedPlayerIds: [],
    playerLastFacedBet: {},
  };
}

/**
 * Validate and compute the result of a player's action.
 * Returns the resolved action or throws on illegal action.
 */
// @MX:ANCHOR fan_in=3 | Action validation and resolution — entry point for all player actions
export function resolveAction(
  player: BettingPlayer,
  actionType: ActionType,
  requestedAmount: number,
  state: BettingRoundState,
): ActionResult {
  switch (actionType) {
    case 'FOLD':
      return { type: 'FOLD', amount: 0, raiseIncrement: 0, isAllIn: false };

    case 'CHECK':
      if (player.currentBet < state.currentBet) {
        throw new Error(
          `Cannot check: facing bet of ${state.currentBet}, player has bet ${player.currentBet}`,
        );
      }
      return { type: 'CHECK', amount: 0, raiseIncrement: 0, isAllIn: false };

    case 'CALL':
      return resolveCall(player, state);

    case 'BET':
      return resolveBet(player, requestedAmount, state);

    case 'RAISE':
      return resolveRaise(player, requestedAmount, state);
  }
}

function resolveCall(player: BettingPlayer, state: BettingRoundState): ActionResult {
  if (state.currentBet === 0 || player.currentBet >= state.currentBet) {
    throw new Error('Cannot call: no bet to call');
  }

  const callAmount = Math.min(state.currentBet - player.currentBet, player.chips);
  const isAllIn = callAmount >= player.chips;

  return { type: 'CALL', amount: callAmount, raiseIncrement: 0, isAllIn };
}

function resolveBet(
  player: BettingPlayer,
  amount: number,
  state: BettingRoundState,
): ActionResult {
  if (state.currentBet > 0) {
    throw new Error('Cannot bet: a bet already exists on this street. Use RAISE instead.');
  }

  const minBet = state.lastFullRaiseSize; // minimum first bet = BB
  const isAllIn = amount >= player.chips;

  // Allow all-in for less than minimum
  if (!isAllIn && amount < minBet) {
    throw new Error(`Bet of ${amount} is below minimum of ${minBet}`);
  }

  const actualAmount = isAllIn ? player.chips : amount;

  return {
    type: 'BET',
    amount: actualAmount,
    raiseIncrement: actualAmount,
    isAllIn,
  };
}

function resolveRaise(
  player: BettingPlayer,
  raiseTo: number,
  state: BettingRoundState,
): ActionResult {
  if (state.currentBet === 0) {
    throw new Error('Cannot raise: no bet to raise. Use BET instead.');
  }

  const minRaiseTo = state.currentBet + state.lastFullRaiseSize;
  const totalNeeded = raiseTo - player.currentBet;
  const isAllIn = totalNeeded >= player.chips;

  // Allow all-in for less than min-raise
  if (!isAllIn && raiseTo < minRaiseTo) {
    throw new Error(`Raise to ${raiseTo} is below minimum of ${minRaiseTo}`);
  }

  const actualRaiseTo = isAllIn ? player.currentBet + player.chips : raiseTo;
  const raiseIncrement = actualRaiseTo - state.currentBet;
  const amountToAdd = actualRaiseTo - player.currentBet;

  return {
    type: 'RAISE',
    amount: amountToAdd,
    raiseIncrement,
    isAllIn,
  };
}

/**
 * Apply an action result to the betting round state.
 * Updates currentBet, lastFullRaiseSize, actedPlayerIds, etc.
 */
// @MX:ANCHOR fan_in=3 | Apply resolved action to player and betting state — mutates both
export function applyAction(
  player: BettingPlayer,
  result: ActionResult,
  state: BettingRoundState,
): void {
  if (result.type === 'FOLD') {
    player.isFolded = true;
    state.actedPlayerIds.push(player.id);
    return;
  }

  if (result.type === 'CHECK') {
    state.actedPlayerIds.push(player.id);
    return;
  }

  if (result.type === 'CALL') {
    player.chips -= result.amount;
    player.currentBet += result.amount;
    if (result.isAllIn) player.isAllIn = true;
    state.actedPlayerIds.push(player.id);
    // Track what this player faced
    state.playerLastFacedBet[player.id] = state.currentBet;
    return;
  }

  // BET or RAISE
  player.chips -= result.amount;
  player.currentBet += result.amount;
  if (result.isAllIn) player.isAllIn = true;

  const newBet = player.currentBet;

  // Track full raise for re-open
  if (result.raiseIncrement >= state.lastFullRaiseSize) {
    state.lastFullRaiseSize = result.raiseIncrement;
  }

  state.currentBet = newBet;
  state.lastAggressorId = player.id;
  // Record what this player faced (their own bet, so no re-open check needed for self)
  state.playerLastFacedBet[player.id] = newBet;

  // A bet/raise reopens action for all previously acted players
  // Clear acted list except current player — everyone else needs to act again
  state.actedPlayerIds = [player.id];
}

/**
 * Check if a previously-acted player has re-open opportunity due to cumulative short all-ins.
 *
 * Re-open occurs when: total increase the player faces (currentBet - playerLastFacedBet)
 * is >= lastFullRaiseSize.
 */
// @MX:NOTE | Cumulative re-open: total increase facing >= lastFullRaiseSize triggers re-action
export function hasReopen(
  playerId: string,
  state: BettingRoundState,
): boolean {
  const lastFaced = state.playerLastFacedBet[playerId];
  if (lastFaced === undefined) return false;

  const increase = state.currentBet - lastFaced;
  return increase >= state.lastFullRaiseSize;
}

/**
 * Check if the betting round is complete.
 * Complete when all active (non-folded, non-all-in) players have acted
 * and no one has a re-open opportunity.
 */
export function isBettingComplete(
  players: BettingPlayer[],
  state: BettingRoundState,
): boolean {
  const activePlayers = players.filter((p) => !p.isFolded && !p.isAllIn);

  // Only one player left (all others folded)
  if (activePlayers.length <= 1) {
    // But also check if there are all-in players
    const nonFolded = players.filter((p) => !p.isFolded);
    if (nonFolded.length <= 1) return true;
    // If there are all-in players but only 1 active, check if active player has acted
    if (activePlayers.length === 1) {
      const player = activePlayers[0]!;
      return state.actedPlayerIds.includes(player.id) && player.currentBet >= state.currentBet;
    }
    return true;
  }

  // All active players must have acted
  for (const p of activePlayers) {
    if (!state.actedPlayerIds.includes(p.id)) return false;
    // Must have matched the current bet
    if (p.currentBet < state.currentBet) return false;
  }

  // Check for re-open opportunities
  for (const p of activePlayers) {
    if (hasReopen(p.id, state) && !state.actedPlayerIds.includes(p.id)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if all remaining players are either all-in or folded (no more betting possible).
 */
export function isAllInRunout(players: BettingPlayer[]): boolean {
  const nonFolded = players.filter((p) => !p.isFolded);
  if (nonFolded.length <= 1) return true;

  const active = nonFolded.filter((p) => !p.isAllIn);
  // 0 active = all are all-in
  // 1 active with everyone else all-in = no more action needed
  return active.length <= 1;
}

/**
 * Determine the correct preflop action order for heads-up.
 * HU: Dealer(SB) acts first preflop, Non-dealer(BB) acts first postflop.
 *
 * @returns Array of player IDs in action order
 */
// @MX:NOTE | HU: SB(dealer) first preflop, BB(non-dealer) first postflop
export function getHUActionOrder(
  sbPlayerId: string,
  bbPlayerId: string,
  street: Street,
): string[] {
  if (street === 'PREFLOP') {
    return [sbPlayerId, bbPlayerId]; // SB first
  }
  return [bbPlayerId, sbPlayerId]; // BB first postflop
}
