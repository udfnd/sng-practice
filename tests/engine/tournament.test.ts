import { describe, it, expect } from 'vitest';
import {
  createDefaultConfig,
  createTournament,
  checkBlindLevelUp,
  eliminatePlayer,
  eliminateSimultaneous,
  isTournamentComplete,
  finalizeTournament,
  calculateMRatio,
  DEFAULT_BLIND_SCHEDULE,
} from '@/engine/tournament';

describe('Tournament Config', () => {
  it('should create default config', () => {
    const config = createDefaultConfig();
    expect(config.playerCount).toBe(8);
    expect(config.startingChips).toBe(1500);
    expect(config.blindSchedule).toHaveLength(10);
    expect(config.payoutStructure).toBe('top3');
  });

  it('should accept overrides', () => {
    const config = createDefaultConfig({ startingChips: 3000, payoutStructure: 'top2' });
    expect(config.startingChips).toBe(3000);
    expect(config.payoutStructure).toBe('top2');
  });

  it('blind schedule should have 10 levels', () => {
    expect(DEFAULT_BLIND_SCHEDULE).toHaveLength(10);
    expect(DEFAULT_BLIND_SCHEDULE[0]!.sb).toBe(10);
    expect(DEFAULT_BLIND_SCHEDULE[9]!.sb).toBe(500);
  });
});

describe('Tournament Creation', () => {
  it('should create tournament with 8 players', () => {
    const config = createDefaultConfig();
    const names = Array.from({ length: 8 }, (_, i) => `Player ${i}`);
    const tournament = createTournament(config, names);

    expect(tournament.gameState.players).toHaveLength(8);
    expect(tournament.totalChips).toBe(12000);
    expect(tournament.isComplete).toBe(false);
    expect(tournament.currentBlindLevelIndex).toBe(0);
  });
});

describe('Blind Level Up', () => {
  it('should advance blind level after configured hands', () => {
    const config = createDefaultConfig({ handsPerLevel: 10 });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    tournament.gameState.handsPlayedInLevel = 10;
    const leveledUp = checkBlindLevelUp(tournament);

    expect(leveledUp).toBe(true);
    expect(tournament.currentBlindLevelIndex).toBe(1);
    expect(tournament.gameState.blindLevel.sb).toBe(15);
    expect(tournament.gameState.handsPlayedInLevel).toBe(0);
  });

  it('should not advance before reaching hand count', () => {
    const config = createDefaultConfig({ handsPerLevel: 10 });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    tournament.gameState.handsPlayedInLevel = 5;
    expect(checkBlindLevelUp(tournament)).toBe(false);
  });

  it('should stay at max level', () => {
    const config = createDefaultConfig({ handsPerLevel: 10 });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    tournament.currentBlindLevelIndex = 9; // max level
    tournament.gameState.handsPlayedInLevel = 10;
    expect(checkBlindLevelUp(tournament)).toBe(false);
  });
});

describe('Player Elimination', () => {
  it('should record elimination with correct position', () => {
    const config = createDefaultConfig();
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);
    tournament.gameState.handNumber = 5;

    const elim = eliminatePlayer(tournament, 'player-7', 1500);
    expect(elim.finishPosition).toBe(8); // 8 active → 8th place
    expect(elim.handNumber).toBe(5);
    expect(tournament.eliminations).toHaveLength(1);
  });

  it('should pay out for ITM positions (top 3)', () => {
    const config = createDefaultConfig({ payoutStructure: 'top3' });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    // Eliminate to 3rd place
    for (let i = 7; i >= 3; i--) {
      eliminatePlayer(tournament, `player-${i}`, 1500);
    }

    // 3rd place should get payout
    const thirdPlace = eliminatePlayer(tournament, 'player-2', 1500);
    expect(thirdPlace.finishPosition).toBe(3);
    expect(thirdPlace.payout).toBe(Math.floor(12000 * 0.20)); // 20% of 12000
  });

  it('should not pay out below ITM', () => {
    const config = createDefaultConfig({ payoutStructure: 'top3' });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    const elim = eliminatePlayer(tournament, 'player-7', 1500);
    expect(elim.payout).toBe(0); // 8th place = no payout
  });
});

describe('Simultaneous Elimination', () => {
  it('should rank by chips at hand start', () => {
    const config = createDefaultConfig();
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    // Eliminate 5 players first
    for (let i = 7; i >= 5; i--) {
      eliminatePlayer(tournament, `player-${i}`, 1500);
    }

    // 5 active, 2 eliminated simultaneously
    const elims = eliminateSimultaneous(tournament, [
      { playerId: 'player-3', chipsAtHandStart: 800 },
      { playerId: 'player-4', chipsAtHandStart: 200 },
    ]);

    // player-3 (800 chips) should rank better (lower number) than player-4 (200 chips)
    const p3 = elims.find((e) => e.playerId === 'player-3')!;
    const p4 = elims.find((e) => e.playerId === 'player-4')!;
    // Both are eliminated from 5 active. p3 has more chips → better rank
    expect(p3.finishPosition).toBeLessThan(p4.finishPosition);
  });

  it('should split payout for tied positions', () => {
    const config = createDefaultConfig({ payoutStructure: 'top3' });
    const names = Array.from({ length: 8 }, (_, i) => `P${i}`);
    const tournament = createTournament(config, names);

    // Eliminate to 4 active
    for (let i = 7; i >= 4; i--) {
      eliminatePlayer(tournament, `player-${i}`, 1500);
    }

    // 2 eliminated simultaneously with equal chips at 4 active
    const elims = eliminateSimultaneous(tournament, [
      { playerId: 'player-2', chipsAtHandStart: 500 },
      { playerId: 'player-3', chipsAtHandStart: 500 },
    ]);

    // Both should get same payout (tied for 3rd/4th)
    expect(elims[0]!.payout).toBe(elims[1]!.payout);
  });
});

describe('Tournament Completion', () => {
  it('should detect completion', () => {
    const config = createDefaultConfig();
    const names = Array.from({ length: 3 }, (_, i) => `P${i}`);
    const tournament = createTournament({ ...config, playerCount: 8 }, names);

    // Eliminate all but one
    eliminatePlayer(tournament, 'player-1', 1500);
    expect(isTournamentComplete(tournament)).toBe(false);

    eliminatePlayer(tournament, 'player-2', 1500);
    expect(isTournamentComplete(tournament)).toBe(true);
  });

  it('should finalize with standings', () => {
    const config = createDefaultConfig();
    const names = Array.from({ length: 3 }, (_, i) => `P${i}`);
    const tournament = createTournament({ ...config, playerCount: 8 }, names);

    tournament.gameState.handNumber = 10;
    eliminatePlayer(tournament, 'player-2', 500);
    eliminatePlayer(tournament, 'player-1', 1000);

    const standings = finalizeTournament(tournament);
    expect(standings[0]!.position).toBe(1);
    expect(standings[0]!.playerId).toBe('player-0'); // winner
    expect(tournament.isComplete).toBe(true);
  });
});

describe('M-Ratio', () => {
  it('should calculate correctly for level 1', () => {
    const m = calculateMRatio(1500, DEFAULT_BLIND_SCHEDULE[0]!);
    // 1500 / (10 + 20 + 5) = 42.86
    expect(m).toBeCloseTo(42.86, 1);
  });

  it('should calculate correctly for push/fold zone', () => {
    const m = calculateMRatio(1500, DEFAULT_BLIND_SCHEDULE[7]!);
    // 1500 / (200 + 400 + 50) = 2.31
    expect(m).toBeCloseTo(2.31, 1);
  });
});
