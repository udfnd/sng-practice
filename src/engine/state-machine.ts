import type { GamePhase, GameState, Player, BlindLevel, Card } from '@/types';
import { resolveSeats, type SeatAssignment } from './seat-resolver';
import { createDeck, dealMany, type Deck } from './deck';
import { createPreflopBettingRound, createBettingRound } from './betting';
import { collectBets, addBbaToMainPot, calcUncalledBet } from './pot';

/**
 * Hand context — tracks per-hand state not stored in GameState.
 */
export interface HandContext {
  deck: Deck;
  seatAssignment: SeatAssignment;
}

/**
 * Create initial player stats.
 */
function emptyStats() {
  return {
    handsEligible: 0,
    vpipCount: 0,
    pfrCount: 0,
    threeBetOpportunities: 0,
    threeBetCount: 0,
    cBetOpportunities: 0,
    cBetCount: 0,
    wentToShowdown: 0,
    wonAtShowdown: 0,
  };
}

/**
 * Create an initial GameState for a new tournament.
 */
export function createInitialGameState(
  playerNames: string[],
  startingChips: number,
  blindLevel: BlindLevel,
  humanSeatIndex: number = 0,
): GameState {
  const players: Player[] = playerNames.map((name, i) => ({
    id: `player-${i}`,
    name,
    seatIndex: i,
    chips: startingChips,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: null,
    isHuman: i === humanSeatIndex,
    isActive: true,
    isFolded: false,
    isAllIn: false,
    aiProfile: null,
    stats: emptyStats(),
  }));

  return {
    phase: 'WAITING',
    players,
    communityCards: [],
    mainPot: 0,
    sidePots: [],
    currentPlayerIndex: -1,
    buttonSeatIndex: -1,
    sbSeatIndex: -1,
    bbSeatIndex: -1,
    blindLevel,
    handsPlayedInLevel: 0,
    handNumber: 0,
    actionHistory: [],
    bettingRound: createBettingRound('PREFLOP', blindLevel.bb),
    seed: '',
  };
}

/**
 * Transition: WAITING → RESOLVE_SEATS
 * Resolve button/SB/BB positions for the new hand.
 */
export function transitionToResolveSeats(state: GameState): SeatAssignment {
  if (state.phase !== 'WAITING') {
    throw new Error(`Invalid transition: expected WAITING, got ${state.phase}`);
  }

  const activeSeats = state.players
    .filter((p) => p.isActive)
    .map((p) => p.seatIndex);

  const assignment = resolveSeats(activeSeats, state.buttonSeatIndex);

  state.phase = 'RESOLVE_SEATS';
  state.buttonSeatIndex = assignment.buttonSeat;
  state.sbSeatIndex = assignment.sbSeat;
  state.bbSeatIndex = assignment.bbSeat;
  state.handNumber += 1;

  return assignment;
}

/**
 * Transition: RESOLVE_SEATS → POSTING_BLINDS
 * Post SB, BB, and BBA.
 */
export function transitionToPostBlinds(state: GameState): void {
  if (state.phase !== 'RESOLVE_SEATS') {
    throw new Error(`Invalid transition: expected RESOLVE_SEATS, got ${state.phase}`);
  }

  const { sb, bb, ante } = state.blindLevel;

  // Reset per-hand state
  for (const p of state.players) {
    p.currentBet = 0;
    p.totalHandBet = 0;
    p.holeCards = null;
    p.isFolded = false;
    p.isAllIn = false;
  }
  state.communityCards = [];
  state.mainPot = 0;
  state.sidePots = [];
  state.actionHistory = [];

  // Post SB
  const sbPlayer = state.players.find((p) => p.seatIndex === state.sbSeatIndex)!;
  const sbAmount = Math.min(sb, sbPlayer.chips);
  sbPlayer.chips -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalHandBet = sbAmount;
  if (sbPlayer.chips === 0) sbPlayer.isAllIn = true;

  // Post BB
  const bbPlayer = state.players.find((p) => p.seatIndex === state.bbSeatIndex)!;
  const bbAmount = Math.min(bb, bbPlayer.chips);
  bbPlayer.chips -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalHandBet = bbAmount;

  // Post BBA (from BB player, dead money → mainPot)
  if (ante > 0) {
    const bbaAmount = Math.min(ante, bbPlayer.chips);
    bbPlayer.chips -= bbaAmount;
    bbPlayer.totalHandBet += bbaAmount;
    state.mainPot = addBbaToMainPot(state.mainPot, bbaAmount);
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
  } else {
    if (bbPlayer.chips === 0) bbPlayer.isAllIn = true;
  }

  state.phase = 'POSTING_BLINDS';
}

/**
 * Transition: POSTING_BLINDS → DEALING
 * Deal 2 hole cards to each active player.
 */
export async function transitionToDealing(
  state: GameState,
  seed?: string,
): Promise<Deck> {
  if (state.phase !== 'POSTING_BLINDS') {
    throw new Error(`Invalid transition: expected POSTING_BLINDS, got ${state.phase}`);
  }

  const deck = await createDeck(seed);
  state.seed = deck.seed;

  const activePlayers = state.players.filter((p) => p.isActive);
  for (const p of activePlayers) {
    p.holeCards = dealMany(deck, 2) as [Card, Card];
  }

  state.phase = 'DEALING';
  return deck;
}

/**
 * Transition: DEALING → PREFLOP
 * Initialize preflop betting round.
 */
export function transitionToPreflop(state: GameState): void {
  if (state.phase !== 'DEALING') {
    throw new Error(`Invalid transition: expected DEALING, got ${state.phase}`);
  }

  state.bettingRound = createPreflopBettingRound(state.blindLevel.bb);
  state.phase = 'PREFLOP';
}

/**
 * Transition to next street (FLOP, TURN, RIVER).
 * Deals community cards and starts new betting round.
 */
// @MX:WARN @MX:REASON="5+ mutations in sequence: collect bets, sync state, deal cards, reset round" | Multi-phase street transition
export function transitionToNextStreet(
  state: GameState,
  deck: Deck,
): void {
  const transitions: Record<string, { next: GamePhase; cards: number }> = {
    PREFLOP: { next: 'FLOP', cards: 3 },
    FLOP: { next: 'TURN', cards: 1 },
    TURN: { next: 'RIVER', cards: 1 },
  };

  const transition = transitions[state.phase];
  if (!transition) {
    throw new Error(`Cannot advance to next street from ${state.phase}`);
  }

  // Collect bets from current street
  const potPlayers = state.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));

  const result = collectBets(potPlayers, state.mainPot, state.sidePots);
  state.mainPot = result.mainPot;
  state.sidePots = result.sidePots;

  // Sync collected state back to players
  for (const p of state.players) {
    const pp = potPlayers.find((pp) => pp.id === p.id)!;
    p.currentBet = pp.currentBet;
    p.chips = pp.chips;
  }

  // Deal community cards
  const newCards = dealMany(deck, transition.cards);
  state.communityCards.push(...newCards);

  // New betting round
  state.bettingRound = createBettingRound(transition.next as any, state.blindLevel.bb);
  state.phase = transition.next;
}

/**
 * Handle fold-win: all but one player folded.
 * collectBets → uncalled return → award pot → HAND_COMPLETE
 */
// @MX:WARN @MX:REASON="collect+uncalled+award in one path, complex bet sync" | Fold-win fast path with multi-step pot resolution
export function handleFoldWin(state: GameState): string {
  const nonFolded = state.players.filter((p) => p.isActive && !p.isFolded);
  if (nonFolded.length !== 1) {
    throw new Error(`Fold-win requires exactly 1 non-folded player, got ${nonFolded.length}`);
  }

  const winner = nonFolded[0]!;

  // Collect remaining street bets
  const potPlayers = state.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));

  // Calculate uncalled bet before collecting.
  // The second-highest bet must include folded players' currentBets, because folded
  // players' bets are still in currentBet and will be collected into the pot.
  // Only the winner (non-folded) can have an uncalled portion above the highest
  // matched bet among all other active players (folded or not).
  const winnerCurrentBet = winner.currentBet;
  const secondHighestBet = state.players
    .filter((p) => p.isActive && p.id !== winner.id)
    .reduce((max, p) => Math.max(max, p.currentBet), 0);

  const uncalledAmount = calcUncalledBet(winnerCurrentBet, secondHighestBet);

  // Return uncalled bet
  if (uncalledAmount > 0) {
    const winnerPot = potPlayers.find((p) => p.id === winner.id)!;
    winnerPot.currentBet -= uncalledAmount;
    winnerPot.chips += uncalledAmount;
  }

  const result = collectBets(potPlayers, state.mainPot, state.sidePots);
  state.mainPot = result.mainPot;
  state.sidePots = result.sidePots;

  // Sync back
  for (const p of state.players) {
    const pp = potPlayers.find((pp) => pp.id === p.id)!;
    p.currentBet = pp.currentBet;
    p.chips = pp.chips;
  }

  // Award all pots to winner
  const totalPot = state.mainPot + state.sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  winner.chips += totalPot;
  state.mainPot = 0;
  state.sidePots = [];

  state.phase = 'HAND_COMPLETE';
  return winner.id;
}

/**
 * Transition to SHOWDOWN.
 */
export function transitionToShowdown(state: GameState): void {
  // Collect remaining bets
  const potPlayers = state.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));

  const result = collectBets(potPlayers, state.mainPot, state.sidePots);
  state.mainPot = result.mainPot;
  state.sidePots = result.sidePots;

  for (const p of state.players) {
    const pp = potPlayers.find((pp) => pp.id === p.id)!;
    p.currentBet = pp.currentBet;
    p.chips = pp.chips;
  }

  state.phase = 'SHOWDOWN';
}

/**
 * Check if only one non-folded player remains (fold-win condition).
 */
export function isFoldWin(state: GameState): boolean {
  const nonFolded = state.players.filter((p) => p.isActive && !p.isFolded);
  return nonFolded.length === 1;
}

/**
 * Complete the hand and prepare for next.
 */
export function transitionToHandComplete(state: GameState): void {
  state.phase = 'HAND_COMPLETE';
  state.handsPlayedInLevel += 1;
}

/**
 * Reset for next hand: HAND_COMPLETE → WAITING
 */
export function transitionToWaiting(state: GameState): void {
  if (state.phase !== 'HAND_COMPLETE') {
    throw new Error(`Invalid transition: expected HAND_COMPLETE, got ${state.phase}`);
  }

  // Mark eliminated players
  for (const p of state.players) {
    if (p.isActive && p.chips === 0) {
      p.isActive = false;
    }
  }

  state.phase = 'WAITING';
}

/**
 * Get the number of active players.
 */
export function activePlayerCount(state: GameState): number {
  return state.players.filter((p) => p.isActive).length;
}
