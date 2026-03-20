import type { BlindLevel, TournamentConfig, TournamentState, Elimination, Standing } from '@/types';
import { createInitialGameState } from './state-machine';

/**
 * Default blind schedule (10 levels with BBA).
 */
export const DEFAULT_BLIND_SCHEDULE: BlindLevel[] = [
  { level: 1, sb: 10, bb: 20, ante: 5 },
  { level: 2, sb: 15, bb: 30, ante: 5 },
  { level: 3, sb: 25, bb: 50, ante: 10 },
  { level: 4, sb: 50, bb: 100, ante: 15 },
  { level: 5, sb: 75, bb: 150, ante: 25 },
  { level: 6, sb: 100, bb: 200, ante: 25 },
  { level: 7, sb: 150, bb: 300, ante: 50 },
  { level: 8, sb: 200, bb: 400, ante: 50 },
  { level: 9, sb: 300, bb: 600, ante: 100 },
  { level: 10, sb: 500, bb: 1000, ante: 100 },
];

/**
 * Payout ratios.
 */
export const PAYOUT_RATIOS = {
  top2: [0.65, 0.35],
  top3: [0.50, 0.30, 0.20],
} as const;

/**
 * Blind speed presets (hands per level).
 */
export const BLIND_SPEEDS = {
  Slow: 20,
  Normal: 10,
  Turbo: 6,
  Hyper: 3,
} as const;

/**
 * Create default tournament config.
 */
export function createDefaultConfig(overrides?: Partial<TournamentConfig>): TournamentConfig {
  return {
    playerCount: 8,
    startingChips: 1500,
    handsPerLevel: 10,
    blindSchedule: DEFAULT_BLIND_SCHEDULE,
    payoutStructure: 'top3',
    payoutRatios: [...PAYOUT_RATIOS.top3],
    initialSeed: null,
    ...overrides,
  };
}

/**
 * Create a new tournament state.
 */
export function createTournament(
  config: TournamentConfig,
  playerNames: string[],
): TournamentState {
  const gameState = createInitialGameState(
    playerNames,
    config.startingChips,
    config.blindSchedule[0]!,
  );

  return {
    tournamentId: crypto.randomUUID(),
    config,
    gameState,
    eliminations: [],
    standings: [],
    isComplete: false,
    currentBlindLevelIndex: 0,
    totalChips: config.startingChips * config.playerCount,
  };
}

/**
 * Check and advance blind level if needed.
 */
export function checkBlindLevelUp(tournament: TournamentState): boolean {
  const { config, gameState } = tournament;

  if (gameState.handsPlayedInLevel >= config.handsPerLevel) {
    const nextLevelIdx = tournament.currentBlindLevelIndex + 1;
    if (nextLevelIdx < config.blindSchedule.length) {
      tournament.currentBlindLevelIndex = nextLevelIdx;
      gameState.blindLevel = config.blindSchedule[nextLevelIdx]!;
      gameState.handsPlayedInLevel = 0;
      return true;
    }
    // Stay at max level
    gameState.handsPlayedInLevel = 0;
  }
  return false;
}

/**
 * Process player elimination.
 */
export function eliminatePlayer(
  tournament: TournamentState,
  playerId: string,
  chipsAtHandStart: number,
): Elimination {
  const activePlayers = tournament.gameState.players.filter((p) => p.isActive);
  const finishPosition = activePlayers.length; // current active count = their finish position

  const player = tournament.gameState.players.find((p) => p.id === playerId)!;
  player.isActive = false;
  player.chips = 0;

  const payout = calculatePayout(tournament, finishPosition);

  const elimination: Elimination = {
    playerId,
    handNumber: tournament.gameState.handNumber,
    finishPosition,
    chipsAtHandStart,
    payout,
  };

  tournament.eliminations.push(elimination);
  return elimination;
}

/**
 * Process simultaneous elimination of multiple players.
 * Higher chips at hand start = better rank.
 * Equal chips = same rank (tie), split prize.
 */
export function eliminateSimultaneous(
  tournament: TournamentState,
  players: { playerId: string; chipsAtHandStart: number }[],
): Elimination[] {
  // Sort by chips ascending (fewer chips = worse position = higher number)
  const sorted = [...players].sort((a, b) => a.chipsAtHandStart - b.chipsAtHandStart);

  const activeCount = tournament.gameState.players.filter((p) => p.isActive).length;
  const eliminations: Elimination[] = [];

  // Assign positions from worst (activeCount) to best
  // Players with fewer chips get higher (worse) position numbers
  let currentPosition = activeCount;
  let i = 0;

  while (i < sorted.length) {
    // Find group of players with same chips (tie)
    const group = [sorted[i]!];
    while (i + 1 < sorted.length && sorted[i + 1]!.chipsAtHandStart === sorted[i]!.chipsAtHandStart) {
      i++;
      group.push(sorted[i]!);
    }

    // Calculate shared payout for tied positions
    let totalPayout = 0;
    for (let j = 0; j < group.length; j++) {
      totalPayout += calculatePayout(tournament, currentPosition - j);
    }
    const sharedPayout = Math.floor(totalPayout / group.length);

    for (const p of group) {
      const player = tournament.gameState.players.find((pl) => pl.id === p.playerId)!;
      player.isActive = false;
      player.chips = 0;

      const elimination: Elimination = {
        playerId: p.playerId,
        handNumber: tournament.gameState.handNumber,
        finishPosition: currentPosition,
        chipsAtHandStart: p.chipsAtHandStart,
        payout: sharedPayout,
      };
      eliminations.push(elimination);
      tournament.eliminations.push(elimination);
    }

    currentPosition -= group.length;
    i++;
  }

  return eliminations;
}

/**
 * Calculate payout for a finish position.
 */
function calculatePayout(tournament: TournamentState, position: number): number {
  const { payoutRatios } = tournament.config;
  const prizePool = tournament.totalChips; // notional

  if (position <= payoutRatios.length) {
    return Math.floor(prizePool * payoutRatios[position - 1]!);
  }
  return 0;
}

/**
 * Check if tournament is complete (1 player remaining).
 */
export function isTournamentComplete(tournament: TournamentState): boolean {
  const activePlayers = tournament.gameState.players.filter((p) => p.isActive);
  return activePlayers.length <= 1;
}

/**
 * Finalize tournament standings.
 */
export function finalizeTournament(tournament: TournamentState): Standing[] {
  tournament.isComplete = true;

  const standings: Standing[] = [];

  // Winner (last active player)
  const winner = tournament.gameState.players.find((p) => p.isActive);
  if (winner) {
    standings.push({
      playerId: winner.id,
      position: 1,
      chips: winner.chips,
      handsPlayed: tournament.gameState.handNumber,
    });
  }

  // Eliminated players (in reverse order of elimination)
  const sortedElims = [...tournament.eliminations].sort((a, b) => b.finishPosition - a.finishPosition);
  for (const elim of sortedElims) {
    standings.push({
      playerId: elim.playerId,
      position: elim.finishPosition,
      chips: 0,
      handsPlayed: elim.handNumber,
    });
  }

  standings.sort((a, b) => a.position - b.position);
  tournament.standings = standings;
  return standings;
}

/**
 * Calculate M-ratio: stack / (SB + BB + BBA).
 */
export function calculateMRatio(chips: number, blindLevel: BlindLevel): number {
  const cost = blindLevel.sb + blindLevel.bb + blindLevel.ante;
  return cost > 0 ? chips / cost : Infinity;
}
