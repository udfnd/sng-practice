import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetSequence,
  handStartEvent,
  postBlindEvent,
  dealHoleEvent,
  dealCommunityEvent,
  playerActionEvent,
  uncalledReturnEvent,
  showdownEvent,
  awardPotEvent,
  playerEliminatedEvent,
  blindLevelUpEvent,
  tournamentEndEvent,
  validateEventOrder,
  eventsEqual,
} from '@/engine/events';
import { fromEncoded } from '@/engine/card';
import type { Card, GameEvent } from '@/types';

function makeCard(encoded: number): Card {
  return fromEncoded(encoded);
}

beforeEach(() => {
  resetSequence();
});

describe('Event Creation', () => {
  it('should create HAND_START event with correct payload', () => {
    const event = handStartEvent(1, 'seed-1', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, [
      { playerId: 'p0', chips: 1500 },
      { playerId: 'p1', chips: 1500 },
    ]);

    expect(event.type).toBe('HAND_START');
    expect(event.handNumber).toBe(1);
    expect(event.sequenceIndex).toBe(0);
    expect(event.payload.type).toBe('HAND_START');
  });

  it('should create POST_BLIND event', () => {
    const event = postBlindEvent(1, 'p1', 10, 'SB');
    expect(event.type).toBe('POST_BLIND');
    expect(event.payload.type).toBe('POST_BLIND');
    if (event.payload.type === 'POST_BLIND') {
      expect(event.payload.amount).toBe(10);
      expect(event.payload.blindType).toBe('SB');
    }
  });

  it('should create DEAL_HOLE event', () => {
    const cards: [Card, Card] = [makeCard(0), makeCard(1)];
    const event = dealHoleEvent(1, 'p0', cards);
    expect(event.type).toBe('DEAL_HOLE');
  });

  it('should create DEAL_COMMUNITY event', () => {
    const cards = [makeCard(10), makeCard(20), makeCard(30)];
    const event = dealCommunityEvent(1, cards, 'FLOP');
    expect(event.type).toBe('DEAL_COMMUNITY');
  });

  it('should create PLAYER_ACTION event', () => {
    const event = playerActionEvent(1, 'p0', 'RAISE', 200, false);
    expect(event.type).toBe('PLAYER_ACTION');
    if (event.payload.type === 'PLAYER_ACTION') {
      expect(event.payload.action).toBe('RAISE');
      expect(event.payload.amount).toBe(200);
    }
  });

  it('should create UNCALLED_RETURN event', () => {
    const event = uncalledReturnEvent(1, 'p0', 100);
    expect(event.type).toBe('UNCALLED_RETURN');
  });

  it('should create SHOWDOWN event', () => {
    const event = showdownEvent(1, [
      { playerId: 'p0', cards: [makeCard(0), makeCard(1)], handRank: 1000 },
    ]);
    expect(event.type).toBe('SHOWDOWN');
  });

  it('should create AWARD_POT event', () => {
    const event = awardPotEvent(1, 0, [{ playerId: 'p0', amount: 500 }]);
    expect(event.type).toBe('AWARD_POT');
    if (event.payload.type === 'AWARD_POT') {
      expect(event.payload.potIndex).toBe(0);
    }
  });

  it('should create PLAYER_ELIMINATED event', () => {
    const event = playerEliminatedEvent(1, 'p7', 8, 0);
    expect(event.type).toBe('PLAYER_ELIMINATED');
  });

  it('should create BLIND_LEVEL_UP event', () => {
    const event = blindLevelUpEvent(1, 2, 15, 30, 5);
    expect(event.type).toBe('BLIND_LEVEL_UP');
  });

  it('should create TOURNAMENT_END event', () => {
    const event = tournamentEndEvent(1, [], []);
    expect(event.type).toBe('TOURNAMENT_END');
  });
});

describe('Sequence Index', () => {
  it('should auto-increment sequenceIndex within a hand', () => {
    const e1 = handStartEvent(1, 'seed', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, []);
    const e2 = postBlindEvent(1, 'p1', 10, 'SB');
    const e3 = postBlindEvent(1, 'p2', 20, 'BB');

    expect(e1.sequenceIndex).toBe(0);
    expect(e2.sequenceIndex).toBe(1);
    expect(e3.sequenceIndex).toBe(2);
  });

  it('should reset on resetSequence()', () => {
    handStartEvent(1, 'seed', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, []);
    postBlindEvent(1, 'p1', 10, 'SB');

    resetSequence();

    const event = handStartEvent(2, 'seed2', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, []);
    expect(event.sequenceIndex).toBe(0);
  });
});

describe('validateEventOrder', () => {
  it('should accept correctly ordered events', () => {
    const events: GameEvent[] = [
      handStartEvent(1, 'seed', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, []),
      postBlindEvent(1, 'p1', 10, 'SB'),
      postBlindEvent(1, 'p2', 20, 'BB'),
    ];
    expect(validateEventOrder(events)).toBe(true);
  });

  it('should reject out-of-order events', () => {
    const events: GameEvent[] = [
      { type: 'HAND_START', timestamp: 0, handNumber: 1, sequenceIndex: 0, payload: {} as any },
      { type: 'POST_BLIND', timestamp: 0, handNumber: 1, sequenceIndex: 0, payload: {} as any },
    ];
    expect(validateEventOrder(events)).toBe(false);
  });

  it('should accept empty and single event', () => {
    expect(validateEventOrder([])).toBe(true);
    expect(validateEventOrder([
      { type: 'HAND_START', timestamp: 0, handNumber: 1, sequenceIndex: 0, payload: {} as any },
    ])).toBe(true);
  });
});

describe('eventsEqual', () => {
  it('should detect equal event sequences (ignoring timestamp)', () => {
    resetSequence();
    const a = [handStartEvent(1, 'seed', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, [])];

    resetSequence();
    const b = [handStartEvent(1, 'seed', { level: 1, sb: 10, bb: 20, ante: 5 }, 0, 1, 2, [])];

    // Timestamps will differ but should still be "equal"
    expect(eventsEqual(a, b)).toBe(true);
  });

  it('should detect different sequences', () => {
    resetSequence();
    const a = [postBlindEvent(1, 'p1', 10, 'SB')];
    resetSequence();
    const b = [postBlindEvent(1, 'p1', 20, 'SB')]; // different amount

    expect(eventsEqual(a, b)).toBe(false);
  });

  it('should detect different lengths', () => {
    resetSequence();
    const a = [postBlindEvent(1, 'p1', 10, 'SB')];
    expect(eventsEqual(a, [])).toBe(false);
  });
});
