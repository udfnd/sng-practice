import { describe, it, expect } from 'vitest';
import { getShowdownOrder, determineWinners } from '@/engine/showdown';
import { toEncoded, fromEncoded } from '@/engine/card';
import type { Player, Card, Suit } from '@/types';

function card(notation: string): Card {
  const rankMap: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const suitMap: Record<string, Suit> = { 's': 'spades', 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs' };
  const rankChar = notation.slice(0, -1);
  const suitChar = notation.slice(-1);
  return fromEncoded(toEncoded(suitMap[suitChar]!, rankMap[rankChar]! as any));
}

function makePlayer(id: string, holeCards: [string, string], opts?: { isAllIn?: boolean }): Player {
  return {
    id,
    name: id,
    seatIndex: parseInt(id.replace('p', '')),
    chips: 1000,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: [card(holeCards[0]), card(holeCards[1])],
    isHuman: false,
    isActive: true,
    isFolded: false,
    isAllIn: opts?.isAllIn ?? false,
    aiProfile: null,
    stats: {
      handsEligible: 0, vpipCount: 0, pfrCount: 0,
      threeBetOpportunities: 0, threeBetCount: 0,
      cBetOpportunities: 0, cBetCount: 0,
      wentToShowdown: 0, wonAtShowdown: 0,
    },
  };
}

describe('getShowdownOrder', () => {
  const community = [card('As'), card('Kh'), card('Qd'), card('7c'), card('2s')];

  it('should put all-in players first', () => {
    const players = [
      makePlayer('p0', ['Js', 'Ts']),
      makePlayer('p1', ['Jh', 'Th'], { isAllIn: true }),
    ];

    const reveals = getShowdownOrder(players, community, null, ['p0', 'p1']);
    expect(reveals[0]!.playerId).toBe('p1'); // all-in first
  });

  it('should put last aggressor first among non-all-in', () => {
    const players = [
      makePlayer('p0', ['Js', 'Ts']),
      makePlayer('p1', ['Jh', 'Th']),
    ];

    const reveals = getShowdownOrder(players, community, 'p1', ['p0', 'p1']);
    expect(reveals[0]!.playerId).toBe('p1'); // aggressor first
  });

  it('should use action order when no aggressor', () => {
    const players = [
      makePlayer('p0', ['Js', 'Ts']),
      makePlayer('p1', ['Jh', 'Th']),
    ];

    const reveals = getShowdownOrder(players, community, null, ['p0', 'p1']);
    expect(reveals[0]!.playerId).toBe('p0'); // first to act
  });

  it('should skip folded players', () => {
    const folded = makePlayer('p0', ['Js', 'Ts']);
    folded.isFolded = true;
    const players = [folded, makePlayer('p1', ['Jh', 'Th'])];

    const reveals = getShowdownOrder(players, community, null, ['p0', 'p1']);
    expect(reveals).toHaveLength(1);
    expect(reveals[0]!.playerId).toBe('p1');
  });
});

describe('determineWinners', () => {
  const community = [card('As'), card('Kh'), card('Qd'), card('7c'), card('2s')];

  it('should find single winner', () => {
    const players = [
      makePlayer('p0', ['Ah', 'Kd']), // Two pair, AK
      makePlayer('p1', ['Jh', 'Th']), // Straight AKQJTs
    ];

    const reveals = getShowdownOrder(players, community, null, ['p0', 'p1']);
    const winners = determineWinners(reveals);
    expect(winners).toEqual(['p1']); // straight beats two pair
  });

  it('should detect tie', () => {
    const players = [
      makePlayer('p0', ['Jh', 'Td']), // Straight AKQJT
      makePlayer('p1', ['Js', 'Tc']), // Same straight
    ];

    const reveals = getShowdownOrder(players, community, null, ['p0', 'p1']);
    const winners = determineWinners(reveals);
    expect(winners).toHaveLength(2);
    expect(winners).toContain('p0');
    expect(winners).toContain('p1');
  });

  it('should handle single player', () => {
    const players = [makePlayer('p0', ['Ah', 'Kd'])];
    const reveals = getShowdownOrder(players, community, null, ['p0']);
    const winners = determineWinners(reveals);
    expect(winners).toEqual(['p0']);
  });
});
