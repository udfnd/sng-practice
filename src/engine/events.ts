import type {
  GameEvent,
  GameEventType,
  EventPayload,
  BlindLevel,
  Card,
  ActionType,
  Standing,
} from '@/types';

let sequenceCounter = 0;

/**
 * Reset sequence counter for a new hand.
 */
// @MX:NOTE | Call at hand start to reset per-hand event sequence counter
export function resetSequence(): void {
  sequenceCounter = 0;
}

/**
 * Create a GameEvent with auto-incrementing sequenceIndex.
 */
function createEvent(
  type: GameEventType,
  handNumber: number,
  payload: EventPayload,
): GameEvent {
  return {
    type,
    timestamp: Date.now(),
    handNumber,
    sequenceIndex: sequenceCounter++,
    payload,
  };
}

export function handStartEvent(
  handNumber: number,
  seed: string,
  blindLevel: BlindLevel,
  buttonSeat: number,
  sbSeat: number,
  bbSeat: number,
  stacks: { playerId: string; chips: number }[],
): GameEvent {
  return createEvent('HAND_START', handNumber, {
    type: 'HAND_START',
    handNumber,
    seed,
    blindLevel,
    buttonSeat,
    sbSeat,
    bbSeat,
    stacks,
  });
}

export function postBlindEvent(
  handNumber: number,
  playerId: string,
  amount: number,
  blindType: 'SB' | 'BB' | 'BBA',
): GameEvent {
  return createEvent('POST_BLIND', handNumber, {
    type: 'POST_BLIND',
    playerId,
    amount,
    blindType,
  });
}

export function dealHoleEvent(
  handNumber: number,
  playerId: string,
  cards: [Card, Card],
): GameEvent {
  return createEvent('DEAL_HOLE', handNumber, {
    type: 'DEAL_HOLE',
    playerId,
    cards,
  });
}

export function dealCommunityEvent(
  handNumber: number,
  cards: Card[],
  street: 'FLOP' | 'TURN' | 'RIVER',
): GameEvent {
  return createEvent('DEAL_COMMUNITY', handNumber, {
    type: 'DEAL_COMMUNITY',
    cards,
    street,
  });
}

export function playerActionEvent(
  handNumber: number,
  playerId: string,
  action: ActionType,
  amount: number,
  isAllIn: boolean,
): GameEvent {
  return createEvent('PLAYER_ACTION', handNumber, {
    type: 'PLAYER_ACTION',
    playerId,
    action,
    amount,
    isAllIn,
  });
}

export function uncalledReturnEvent(
  handNumber: number,
  playerId: string,
  amount: number,
): GameEvent {
  return createEvent('UNCALLED_RETURN', handNumber, {
    type: 'UNCALLED_RETURN',
    playerId,
    amount,
  });
}

export function showdownEvent(
  handNumber: number,
  reveals: { playerId: string; cards: [Card, Card]; handRank: number }[],
): GameEvent {
  return createEvent('SHOWDOWN', handNumber, {
    type: 'SHOWDOWN',
    reveals,
  });
}

export function awardPotEvent(
  handNumber: number,
  potIndex: number,
  payouts: { playerId: string; amount: number }[],
): GameEvent {
  return createEvent('AWARD_POT', handNumber, {
    type: 'AWARD_POT',
    potIndex,
    payouts,
  });
}

export function playerEliminatedEvent(
  handNumber: number,
  playerId: string,
  finishPosition: number,
  payout: number,
): GameEvent {
  return createEvent('PLAYER_ELIMINATED', handNumber, {
    type: 'PLAYER_ELIMINATED',
    playerId,
    finishPosition,
    payout,
  });
}

export function blindLevelUpEvent(
  handNumber: number,
  newLevel: number,
  sb: number,
  bb: number,
  ante: number,
): GameEvent {
  return createEvent('BLIND_LEVEL_UP', handNumber, {
    type: 'BLIND_LEVEL_UP',
    newLevel,
    sb,
    bb,
    ante,
  });
}

export function tournamentEndEvent(
  handNumber: number,
  standings: Standing[],
  payouts: { playerId: string; amount: number }[],
): GameEvent {
  return createEvent('TOURNAMENT_END', handNumber, {
    type: 'TOURNAMENT_END',
    standings,
    payouts,
  });
}

/**
 * Validate event ordering: sequenceIndex must be monotonically increasing.
 */
export function validateEventOrder(events: GameEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.sequenceIndex <= events[i - 1]!.sequenceIndex) {
      return false;
    }
  }
  return true;
}

/**
 * Compare two event sequences for deterministic equality.
 * Ignores timestamp (non-canonical field).
 */
export function eventsEqual(a: GameEvent[], b: GameEvent[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const ea = a[i]!;
    const eb = b[i]!;
    if (ea.type !== eb.type) return false;
    if (ea.handNumber !== eb.handNumber) return false;
    if (ea.sequenceIndex !== eb.sequenceIndex) return false;
    // Deep compare payloads (timestamp excluded)
    if (JSON.stringify(ea.payload) !== JSON.stringify(eb.payload)) return false;
  }

  return true;
}
