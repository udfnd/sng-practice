import type {
  GameEvent,
  GameState,
  Player,
  PlayerStats,
  HandStartPayload,
  PostBlindPayload,
  DealHolePayload,
  DealCommunityPayload,
  PlayerActionPayload,
  UncalledReturnPayload,
  AwardPotPayload,
  PlayerEliminatedPayload,
  BlindLevelUpPayload,
} from '@/types';
import { createBettingRound } from './betting';
import { collectBets } from './pot';

// ============================================================
// Error types
// ============================================================

/**
 * Thrown by validateEventSequence when the sequence is structurally invalid.
 */
export class EventSequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventSequenceError';
  }
}

// ============================================================
// Internal helpers
// ============================================================

function emptyStats(): PlayerStats {
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
 * Create an empty GameState skeleton.
 * Used as the initial accumulator for the reducer.
 */
function emptyGameState(): GameState {
  return {
    phase: 'WAITING',
    players: [],
    communityCards: [],
    mainPot: 0,
    sidePots: [],
    currentPlayerIndex: -1,
    buttonSeatIndex: -1,
    sbSeatIndex: -1,
    bbSeatIndex: -1,
    blindLevel: { level: 1, sb: 10, bb: 20, ante: 0 },
    handsPlayedInLevel: 0,
    handNumber: 0,
    actionHistory: [],
    bettingRound: createBettingRound('PREFLOP', 20),
    seed: '',
  };
}

/**
 * Deep-clone a GameState so the reducer is pure (no mutation of prior states).
 */
function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      holeCards: p.holeCards ? [{ ...p.holeCards[0] }, { ...p.holeCards[1] }] : null,
      aiProfile: p.aiProfile ? { ...p.aiProfile } : null,
      stats: { ...p.stats },
    })),
    communityCards: state.communityCards.map((c) => ({ ...c })),
    sidePots: state.sidePots.map((sp) => ({ ...sp, eligiblePlayerIds: [...sp.eligiblePlayerIds] })),
    bettingRound: {
      ...state.bettingRound,
      actedPlayerIds: [...state.bettingRound.actedPlayerIds],
      playerLastFacedBet: { ...state.bettingRound.playerLastFacedBet },
    },
    actionHistory: [...state.actionHistory],
  };
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Collect all outstanding player bets into pots in the given state.
 * Mirrors the behavior of collectBets() called in state-machine transitions.
 * Returns a new state with bets zeroed and pots updated.
 */
function collectOutstandingBets(state: GameState): GameState {
  const hasAnyBets = state.players.some((p) => p.currentBet > 0);
  if (!hasAnyBets) return state;

  const potPlayers = state.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));

  const collected = collectBets(potPlayers, state.mainPot, state.sidePots);

  const next = cloneState(state);
  next.mainPot = collected.mainPot;
  next.sidePots = collected.sidePots;
  for (const p of next.players) {
    const pp = potPlayers.find((pp) => pp.id === p.id)!;
    p.currentBet = pp.currentBet;
  }

  return next;
}

// ============================================================
// Event application functions (pure, return new state)
// ============================================================

function applyHandStart(state: GameState, payload: HandStartPayload): GameState {
  const next = cloneState(state);

  next.handNumber = payload.handNumber;
  next.seed = payload.seed;
  next.blindLevel = { ...payload.blindLevel };
  next.buttonSeatIndex = payload.buttonSeat;
  next.sbSeatIndex = payload.sbSeat;
  next.bbSeatIndex = payload.bbSeat;
  next.communityCards = [];
  next.mainPot = 0;
  next.sidePots = [];
  next.actionHistory = [];
  next.phase = 'POSTING_BLINDS';

  // Build players from stacks
  next.players = payload.stacks.map((stack, i): Player => {
    // Preserve existing player data (name, aiProfile, isHuman, etc.) if available
    const existing = state.players.find((p) => p.id === stack.playerId);
    return {
      id: stack.playerId,
      name: existing?.name ?? stack.playerId,
      seatIndex: existing?.seatIndex ?? i,
      chips: stack.chips,
      currentBet: 0,
      totalHandBet: 0,
      holeCards: null,
      isHuman: existing?.isHuman ?? false,
      isActive: true,
      isFolded: false,
      isAllIn: false,
      aiProfile: existing?.aiProfile ?? null,
      stats: existing?.stats ?? emptyStats(),
    };
  });

  next.bettingRound = createBettingRound('PREFLOP', payload.blindLevel.bb);

  return next;
}

function applyPostBlind(state: GameState, payload: PostBlindPayload): GameState {
  const next = cloneState(state);
  const player = next.players.find((p) => p.id === payload.playerId);
  if (!player) return next;

  if (payload.blindType === 'BBA') {
    // BBA goes directly to main pot as dead money
    const bbaAmount = Math.min(payload.amount, player.chips);
    player.chips -= bbaAmount;
    player.totalHandBet += bbaAmount;
    next.mainPot += bbaAmount;
    if (player.chips === 0) player.isAllIn = true;
  } else {
    // SB or BB: goes to player.currentBet
    const amount = Math.min(payload.amount, player.chips);
    player.chips -= amount;
    player.currentBet = amount;
    player.totalHandBet = amount;
    if (player.chips === 0) player.isAllIn = true;
  }

  return next;
}

function applyDealHole(state: GameState, payload: DealHolePayload): GameState {
  const next = cloneState(state);
  const player = next.players.find((p) => p.id === payload.playerId);
  if (player) {
    player.holeCards = [{ ...payload.cards[0] }, { ...payload.cards[1] }];
  }
  next.phase = 'DEALING';
  return next;
}

function applyDealCommunity(state: GameState, payload: DealCommunityPayload): GameState {
  // Collect bets from the prior street into pots (mirrors transitionToNextStreet in state-machine)
  const collected = collectOutstandingBets(state);
  const next = cloneState(collected);

  // Add community cards
  const newCards = payload.cards.map((c) => ({ ...c }));
  next.communityCards.push(...newCards);

  // Transition phase
  const phaseMap: Record<string, GameState['phase']> = {
    FLOP: 'FLOP',
    TURN: 'TURN',
    RIVER: 'RIVER',
  };
  next.phase = phaseMap[payload.street] ?? next.phase;

  return next;
}

function applyPlayerAction(state: GameState, payload: PlayerActionPayload): GameState {
  const next = cloneState(state);
  const player = next.players.find((p) => p.id === payload.playerId);
  if (!player) return next;

  switch (payload.action) {
    case 'FOLD':
      player.isFolded = true;
      break;

    case 'CHECK':
      // No chip movement
      break;

    case 'CALL': {
      const callAmount = Math.min(payload.amount, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalHandBet += callAmount;
      if (payload.isAllIn) player.isAllIn = true;
      break;
    }

    case 'BET':
    case 'RAISE': {
      // payload.amount is the amount ADDED to player's stack
      const betAmount = Math.min(payload.amount, player.chips);
      player.chips -= betAmount;
      player.currentBet += betAmount;
      player.totalHandBet += betAmount;
      if (payload.isAllIn) player.isAllIn = true;
      break;
    }
  }

  return next;
}

function applyUncalledReturn(state: GameState, payload: UncalledReturnPayload): GameState {
  const next = cloneState(state);
  const player = next.players.find((p) => p.id === payload.playerId);
  if (player) {
    player.chips += payload.amount;
    player.currentBet -= payload.amount;
    if (player.currentBet < 0) player.currentBet = 0;
  }
  return next;
}

function applyAwardPot(state: GameState, payload: AwardPotPayload): GameState {
  // For the first AWARD_POT, ensure any outstanding bets are collected first.
  // This handles the fold-win path where there is no preceding SHOWDOWN event.
  const preCollected = payload.potIndex === 0 ? collectOutstandingBets(state) : state;
  const next = cloneState(preCollected);

  // Award chips to winners
  for (const payout of payload.payouts) {
    const player = next.players.find((p) => p.id === payout.playerId);
    if (player) {
      player.chips += payout.amount;
    }
  }

  // Deduct from the correct pot bucket
  const totalPayout = payload.payouts.reduce((sum, p) => sum + p.amount, 0);

  if (payload.potIndex === 0) {
    next.mainPot = Math.max(0, next.mainPot - totalPayout);
  } else {
    // Side pot: deduct from the first side pot (they're consumed in order)
    const sidePotIdx = payload.potIndex - 1;
    if (sidePotIdx < next.sidePots.length) {
      next.sidePots[sidePotIdx]!.amount = Math.max(
        0,
        next.sidePots[sidePotIdx]!.amount - totalPayout,
      );
    } else if (next.sidePots.length > 0) {
      // Fallback: deduct from last side pot
      next.sidePots[next.sidePots.length - 1]!.amount = Math.max(
        0,
        next.sidePots[next.sidePots.length - 1]!.amount - totalPayout,
      );
    }
  }

  return next;
}

function applyPlayerEliminated(state: GameState, payload: PlayerEliminatedPayload): GameState {
  const next = cloneState(state);
  const player = next.players.find((p) => p.id === payload.playerId);
  if (player) {
    player.isActive = false;
  }
  return next;
}

function applyBlindLevelUp(state: GameState, payload: BlindLevelUpPayload): GameState {
  const next = cloneState(state);
  next.blindLevel = {
    level: payload.newLevel,
    sb: payload.sb,
    bb: payload.bb,
    ante: payload.ante,
  };
  return next;
}

/**
 * Apply a single event to a state, returning a new state.
 * This is the core pure reducer function.
 */
function applyEvent(state: GameState, event: GameEvent): GameState {
  const payload = event.payload;

  switch (event.type) {
    case 'HAND_START':
      return applyHandStart(state, payload as HandStartPayload);

    case 'POST_BLIND':
      return applyPostBlind(state, payload as PostBlindPayload);

    case 'DEAL_HOLE':
      return applyDealHole(state, payload as DealHolePayload);

    case 'DEAL_COMMUNITY':
      return applyDealCommunity(state, payload as DealCommunityPayload);

    case 'PLAYER_ACTION':
      return applyPlayerAction(state, payload as PlayerActionPayload);

    case 'UNCALLED_RETURN':
      return applyUncalledReturn(state, payload as UncalledReturnPayload);

    case 'SHOWDOWN': {
      // At showdown, collect remaining street bets into pot (mirrors transitionToShowdown)
      const showdownNext = { ...collectOutstandingBets(state), phase: 'SHOWDOWN' as const };
      return showdownNext;
    }

    case 'AWARD_POT':
      return applyAwardPot(state, payload as AwardPotPayload);

    case 'PLAYER_ELIMINATED':
      return applyPlayerEliminated(state, payload as PlayerEliminatedPayload);

    case 'BLIND_LEVEL_UP':
      return applyBlindLevelUp(state, payload as BlindLevelUpPayload);

    case 'TOURNAMENT_END':
      // Informational: no state changes needed
      return cloneState(state);

    default:
      return cloneState(state);
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Reduce a complete sequence of GameEvents into a GameState.
 * This is a pure function: it does not mutate the input array.
 *
 * @throws EventSequenceError if the sequence is structurally invalid
 */
export function reduceEvents(events: GameEvent[]): GameState {
  return reduceEventsPartial(events, events.length);
}

/**
 * Reduce events up to (but not including) the given index.
 * Processes events[0..upToIndex-1].
 *
 * @throws EventSequenceError if an initial HAND_START is not found when needed
 */
export function reduceEventsPartial(events: GameEvent[], upToIndex: number): GameState {
  const slice = events.slice(0, upToIndex);
  let state = emptyGameState();

  for (const event of slice) {
    state = applyEvent(state, event);
  }

  return state;
}

/**
 * Validate that an event sequence is structurally valid.
 * Returns true if valid, throws EventSequenceError if invalid.
 */
export function validateEventSequence(events: GameEvent[]): boolean {
  if (events.length === 0) {
    throw new EventSequenceError('Event sequence is empty');
  }

  if (events[0]!.type !== 'HAND_START') {
    throw new EventSequenceError(
      `First event must be HAND_START, got ${events[0]!.type}`,
    );
  }

  // Must have a terminal event (AWARD_POT or TOURNAMENT_END)
  const hasTerminal = events.some(
    (e) => e.type === 'AWARD_POT' || e.type === 'TOURNAMENT_END',
  );

  if (!hasTerminal) {
    throw new EventSequenceError(
      'Event sequence has no terminal event (AWARD_POT or TOURNAMENT_END)',
    );
  }

  // Sequence indices should be monotonically increasing
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.sequenceIndex <= events[i - 1]!.sequenceIndex) {
      throw new EventSequenceError(
        `Event sequence index violation at index ${i}: ` +
        `${events[i]!.sequenceIndex} <= ${events[i - 1]!.sequenceIndex}`,
      );
    }
  }

  return true;
}
