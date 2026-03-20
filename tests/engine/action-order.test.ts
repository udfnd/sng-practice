import { describe, it, expect } from 'vitest';
import {
  getActionOrder,
  getNextPlayer,
  getValidActions,
} from '@/engine/action-order';
import type { BettingRoundState } from '@/types';
import type { BettingPlayer } from '@/engine/betting';
import { createBettingRound, createPreflopBettingRound } from '@/engine/betting';

// ============================================================
// Helper factories
// ============================================================

function makePlayers(count: number, options?: { allInAt?: number[]; foldedAt?: number[] }): BettingPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    chips: 1000,
    currentBet: 0,
    isFolded: options?.foldedAt?.includes(i) ?? false,
    isAllIn: options?.allInAt?.includes(i) ?? false,
  }));
}

function makeGameState(
  activeSeatIndices: number[],
  buttonSeatIndex: number,
  sbSeatIndex: number,
  bbSeatIndex: number,
  players: BettingPlayer[],
  bettingRound: BettingRoundState,
) {
  return {
    players: activeSeatIndices.map((seat, i) => ({
      ...players[i]!,
      seatIndex: seat,
      isActive: true,
    })),
    buttonSeatIndex,
    sbSeatIndex,
    bbSeatIndex,
    bettingRound,
  };
}

// ============================================================
// AC-4: 8-player preflop action order (UTG first)
// ============================================================

describe('getActionOrder - multiway preflop (AC-4)', () => {
  it('should start UTG (left of BB) preflop in 8-player game', () => {
    // Seats 0-7, button=0, SB=1, BB=2 → UTG=3 first
    const activeSeatIndices = [0, 1, 2, 3, 4, 5, 6, 7];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 1;
    const bbSeatIndex = 2;
    const bettingRound = createPreflopBettingRound(100);

    const players = makePlayers(8);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    // UTG (seat 3) should be first, button (seat 0) should be last preflop
    expect(order[0]).toBe('player-3');
    // BB (seat 2) should be last in preflop (gets option)
    expect(order[order.length - 1]).toBe('player-2');
    expect(order).toHaveLength(8);
  });

  it('should return all 8 player IDs in correct preflop order', () => {
    const activeSeatIndices = [0, 1, 2, 3, 4, 5, 6, 7];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 1;
    const bbSeatIndex = 2;
    const bettingRound = createPreflopBettingRound(100);

    const players = makePlayers(8);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    // Expected: UTG(3), UTG+1(4), UTG+2(5), HJ(6), CO(7), BTN(0), SB(1), BB(2)
    expect(order).toEqual([
      'player-3',
      'player-4',
      'player-5',
      'player-6',
      'player-7',
      'player-0',
      'player-1',
      'player-2',
    ]);
  });
});

// ============================================================
// AC-5: HU preflop order (SB first)
// ============================================================

describe('getActionOrder - heads-up preflop (AC-5)', () => {
  it('should have SB act first preflop in HU', () => {
    // HU: button=SB=seat 0, BB=seat 1
    const activeSeatIndices = [0, 1];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 0;
    const bbSeatIndex = 1;
    const bettingRound = createPreflopBettingRound(100);

    const players = makePlayers(2);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    expect(order[0]).toBe('player-0'); // SB (also BTN)
    expect(order[1]).toBe('player-1'); // BB
  });
});

// ============================================================
// AC-6: HU postflop order (BB first)
// ============================================================

describe('getActionOrder - heads-up postflop (AC-6)', () => {
  it('should have BB act first postflop in HU', () => {
    const activeSeatIndices = [0, 1];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 0;
    const bbSeatIndex = 1;
    const bettingRound = createBettingRound('FLOP', 100);

    const players = makePlayers(2);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    expect(order[0]).toBe('player-1'); // BB first postflop
    expect(order[1]).toBe('player-0'); // SB second
  });

  it('should have BB act first on TURN and RIVER in HU', () => {
    for (const street of ['TURN', 'RIVER'] as const) {
      const activeSeatIndices = [0, 1];
      const buttonSeatIndex = 0;
      const sbSeatIndex = 0;
      const bbSeatIndex = 1;
      const bettingRound = createBettingRound(street, 100);

      const players = makePlayers(2);
      const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

      const order = getActionOrder(state as any);
      expect(order[0]).toBe('player-1'); // BB first
    }
  });
});

// ============================================================
// Multiway postflop: first after button acts first
// ============================================================

describe('getActionOrder - multiway postflop', () => {
  it('should start from first active player left of button on postflop', () => {
    // Seats 0(BTN), 1(SB), 2(BB), 3, 4
    const activeSeatIndices = [0, 1, 2, 3, 4];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 1;
    const bbSeatIndex = 2;
    const bettingRound = createBettingRound('FLOP', 100);

    const players = makePlayers(5);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    // SB (1) first postflop, then BB (2), then 3, 4, BTN (0) last
    expect(order[0]).toBe('player-1');
    expect(order[order.length - 1]).toBe('player-0');
  });
});

// ============================================================
// AC-7: Skip folded/all-in players in getNextPlayer
// ============================================================

describe('getNextPlayer - skip folded and all-in (AC-7)', () => {
  it('should skip folded players when finding next to act', () => {
    const bettingRound = createPreflopBettingRound(100);
    const players: BettingPlayer[] = [
      { id: 'A', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'B', chips: 0, currentBet: 100, isFolded: true, isAllIn: false }, // folded
      { id: 'C', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
    ];
    // Action order: A, B, C — B is folded so skip to C
    const bettingPlayers = players;

    const nextId = getNextPlayer(
      ['A', 'B', 'C'],
      bettingPlayers,
      bettingRound,
      'A',
    );

    expect(nextId).toBe('C'); // skips folded B
  });

  it('should skip all-in players when finding next to act', () => {
    const bettingRound = createPreflopBettingRound(100);
    const players: BettingPlayer[] = [
      { id: 'A', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'B', chips: 0, currentBet: 100, isFolded: false, isAllIn: true }, // all-in
      { id: 'C', chips: 900, currentBet: 100, isFolded: false, isAllIn: false },
    ];

    const nextId = getNextPlayer(
      ['A', 'B', 'C'],
      players,
      bettingRound,
      'A',
    );

    expect(nextId).toBe('C'); // skips all-in B
  });

  it('should return null when betting is complete', () => {
    const bettingRound = createPreflopBettingRound(100);
    bettingRound.currentBet = 100;
    bettingRound.actedPlayerIds = ['A', 'B'];

    const players: BettingPlayer[] = [
      { id: 'A', chips: 900, currentBet: 100, isFolded: false, isAllIn: false },
      { id: 'B', chips: 900, currentBet: 100, isFolded: false, isAllIn: false },
    ];

    const nextId = getNextPlayer(
      ['A', 'B'],
      players,
      bettingRound,
      'B',
    );

    expect(nextId).toBeNull();
  });

  it('should return null when all remaining players are folded or all-in', () => {
    const bettingRound = createPreflopBettingRound(100);
    const players: BettingPlayer[] = [
      { id: 'A', chips: 0, currentBet: 100, isFolded: false, isAllIn: true },
      { id: 'B', chips: 0, currentBet: 0, isFolded: true, isAllIn: false },
    ];

    const nextId = getNextPlayer(
      ['A', 'B'],
      players,
      bettingRound,
      'A',
    );

    expect(nextId).toBeNull();
  });

  it('should return null when only one player remains (fold-win)', () => {
    const bettingRound = createPreflopBettingRound(100);
    const players: BettingPlayer[] = [
      { id: 'A', chips: 900, currentBet: 100, isFolded: false, isAllIn: false },
      { id: 'B', chips: 0, currentBet: 0, isFolded: true, isAllIn: false },
      { id: 'C', chips: 0, currentBet: 0, isFolded: true, isAllIn: false },
    ];

    const nextId = getNextPlayer(
      ['A', 'B', 'C'],
      players,
      bettingRound,
      'A',
    );

    expect(nextId).toBeNull();
  });

  it('should wrap around clockwise to find next player', () => {
    const bettingRound = createBettingRound('FLOP', 100);
    const players: BettingPlayer[] = [
      { id: 'A', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'B', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'C', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
    ];

    // Order is A, B, C — current is C, should wrap to A
    const nextId = getNextPlayer(
      ['A', 'B', 'C'],
      players,
      bettingRound,
      'C',
    );

    // After C comes A (wrap), and A hasn't acted
    expect(nextId).toBe('A');
  });
});

// ============================================================
// AC-8: Valid actions with no bet (CHECK, BET)
// ============================================================

describe('getValidActions - no bet facing (AC-8)', () => {
  it('should include CHECK and BET when no bet is facing', () => {
    const bettingRound = createBettingRound('FLOP', 100);
    const player: BettingPlayer = {
      id: 'A',
      chips: 1000,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 100);

    expect(result.canCheck).toBe(true);
    expect(result.canBet).toBe(true);
    expect(result.canCall).toBe(false);
    expect(result.canRaise).toBe(false);
    expect(result.canFold).toBe(true);
    expect(result.minBet).toBe(100); // min bet = BB
    expect(result.maxBet).toBe(1000); // all-in
  });

  it('should return correct min/max bet when no current bet', () => {
    const bettingRound = createBettingRound('FLOP', 50);
    const player: BettingPlayer = {
      id: 'A',
      chips: 500,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 50);

    expect(result.minBet).toBe(50);
    expect(result.maxBet).toBe(500);
  });
});

// ============================================================
// AC-9: Valid actions facing bet (FOLD, CALL, RAISE)
// ============================================================

describe('getValidActions - facing a bet (AC-9)', () => {
  it('should include FOLD, CALL, RAISE when facing a bet', () => {
    const bettingRound = createPreflopBettingRound(100);
    bettingRound.currentBet = 300; // someone raised to 300
    bettingRound.lastFullRaiseSize = 200;

    const player: BettingPlayer = {
      id: 'A',
      chips: 1000,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 100);

    expect(result.canFold).toBe(true);
    expect(result.canCall).toBe(true);
    expect(result.canRaise).toBe(true);
    expect(result.canCheck).toBe(false);
    expect(result.canBet).toBe(false);
    expect(result.callAmount).toBe(300); // call 300
    expect(result.minRaise).toBe(500); // 300 + 200 = 500
    expect(result.maxRaise).toBe(1000); // all-in
  });

  it('should not allow raise if player has insufficient chips', () => {
    const bettingRound = createPreflopBettingRound(100);
    bettingRound.currentBet = 300;
    bettingRound.lastFullRaiseSize = 200;

    const player: BettingPlayer = {
      id: 'A',
      chips: 200, // only enough to call (not to min-raise to 500)
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 100);

    expect(result.canCall).toBe(true);
    // Can still go all-in (which counts as a raise even if below min)
    expect(result.canRaise).toBe(true); // all-in raise allowed
    expect(result.callAmount).toBe(200); // partial call (all-in)
  });

  it('should compute correct call amount when player has partial bet', () => {
    const bettingRound = createPreflopBettingRound(100);
    bettingRound.currentBet = 300;

    const player: BettingPlayer = {
      id: 'BB',
      chips: 1000,
      currentBet: 100, // already posted BB
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 100);

    expect(result.canCall).toBe(true);
    expect(result.callAmount).toBe(200); // 300 - 100 = 200 more to call
  });

  it('should allow FOLD when facing a bet preflop', () => {
    const bettingRound = createPreflopBettingRound(100);
    const player: BettingPlayer = {
      id: 'A',
      chips: 1000,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
    };

    const result = getValidActions(player, bettingRound, 100);

    expect(result.canFold).toBe(true);
  });
});

// ============================================================
// Edge case: 3-player preflop action order
// ============================================================

describe('getActionOrder - 3-player preflop', () => {
  it('should have BTN act first preflop in 3-player game (UTG=BTN)', () => {
    // In 3-player: seats 0(BTN/UTG), 1(SB), 2(BB)
    const activeSeatIndices = [0, 1, 2];
    const buttonSeatIndex = 0;
    const sbSeatIndex = 1;
    const bbSeatIndex = 2;
    const bettingRound = createPreflopBettingRound(100);

    const players = makePlayers(3);
    const state = makeGameState(activeSeatIndices, buttonSeatIndex, sbSeatIndex, bbSeatIndex, players, bettingRound);

    const order = getActionOrder(state as any);

    // BTN acts first (UTG in 3-max)
    expect(order[0]).toBe('player-0'); // BTN/UTG
    expect(order[1]).toBe('player-1'); // SB
    expect(order[2]).toBe('player-2'); // BB (last, has option)
  });
});

// ============================================================
// Edge case: button at high seat index (wrap-around)
// ============================================================

describe('getActionOrder - seat wrap-around', () => {
  it('should correctly wrap around when button is at highest seat', () => {
    // Seats 0, 3, 7; button at seat 7
    const activeSeatIndices = [0, 3, 7];
    const buttonSeatIndex = 7;
    const sbSeatIndex = 0;
    const bbSeatIndex = 3;
    const bettingRound = createPreflopBettingRound(100);

    // Create players with matching seat indices
    const players: BettingPlayer[] = [
      { id: 'p0', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'p3', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
      { id: 'p7', chips: 1000, currentBet: 0, isFolded: false, isAllIn: false },
    ];

    const state = {
      players: activeSeatIndices.map((seat, i) => ({
        ...players[i]!,
        seatIndex: seat,
        isActive: true,
      })),
      buttonSeatIndex,
      sbSeatIndex,
      bbSeatIndex,
      bettingRound,
    };

    const order = getActionOrder(state as any);

    // In 3-player: BTN acts first preflop, then SB, then BB
    expect(order[0]).toBe('p7'); // BTN/UTG
    expect(order[1]).toBe('p0'); // SB
    expect(order[2]).toBe('p3'); // BB
  });
});
