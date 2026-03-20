import { runTournament } from '@/engine/orchestrator';
import { createTournament, createDefaultConfig } from '@/engine/tournament';
import { selectAIAction } from '@/ai/action-selector';
import { PRESETS } from '@/ai/presets';
import { seedFromString, nextFloat } from '@/engine/prng';
import type { PresetType, Player, GameEvent } from '@/types';

// ============================================================
// Public types
// ============================================================

export interface SimulationConfig {
  sngCount: number;
  /** typically 6 or 8 */
  playersPerSNG: number;
  /** seatIndex -> preset name */
  presetAssignments: Record<number, string>;
  masterSeed: string;
  /** optional max hands per SNG */
  handsLimit?: number;
}

export interface PresetStats {
  vpip: number;
  pfr: number;
  threeBet: number;
  vpipTarget: number;
  pfrTarget: number;
  threeBetTarget: number;
  handsEligible: number;
  threeBetOpportunities: number;
  avgFinishPosition: number;
  finishPositionStdDev: number;
  firstPlaceRate: number;
  /** array of finish positions (one entry per SNG appearance) */
  results: number[];
  /** raw counts for independent verification */
  vpipCount: number;
  pfrCount: number;
  threeBetCount: number;
}

export interface SimulationResult {
  sngsCompleted: number;
  sngsErrored: number;
  perPreset: Record<string, PresetStats>;
  chipConservationPassed: boolean;
  timingMs: {
    totalMs: number;
    avgHandMs: number;
    totalHands: number;
  };
}

// ============================================================
// Internal aggregation types
// ============================================================

interface PresetAccumulator {
  vpipCount: number;
  pfrCount: number;
  threeBetCount: number;
  handsEligible: number;
  threeBetOpportunities: number;
  results: number[];
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Run a batch of all-AI SNG simulations and aggregate statistics.
 */
export async function runBatchSimulation(config: SimulationConfig): Promise<SimulationResult> {
  const startTime = performance.now();

  const {
    sngCount,
    playersPerSNG,
    presetAssignments,
    masterSeed,
  } = config;

  // Initialize per-preset accumulators
  const accumulators: Record<string, PresetAccumulator> = {};
  for (const presetName of Object.values(presetAssignments)) {
    if (!accumulators[presetName]) {
      accumulators[presetName] = {
        vpipCount: 0,
        pfrCount: 0,
        threeBetCount: 0,
        handsEligible: 0,
        threeBetOpportunities: 0,
        results: [],
      };
    }
  }

  let sngsCompleted = 0;
  let sngsErrored = 0;
  let chipConservationPassed = true;
  let totalHands = 0;

  for (let i = 0; i < sngCount; i++) {
    try {
      const sngSeed = masterSeed + i.toString();
      const handsThisSng = await runSingleSNG(
        sngSeed,
        playersPerSNG,
        presetAssignments,
        accumulators,
        (conserved) => {
          if (!conserved) chipConservationPassed = false;
        },
      );
      totalHands += handsThisSng;
      sngsCompleted++;
    } catch (err) {
      sngsErrored++;
      // Log but don't stop the batch
      console.warn(`SNG ${i} errored: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const totalMs = performance.now() - startTime;
  const avgHandMs = totalHands > 0 ? totalMs / totalHands : 0;

  // Build final per-preset stats
  const perPreset: Record<string, PresetStats> = {};

  for (const [presetName, acc] of Object.entries(accumulators)) {
    const preset = PRESETS[presetName as PresetType];

    const vpip = acc.handsEligible > 0 ? acc.vpipCount / acc.handsEligible : 0;
    const pfr = acc.handsEligible > 0 ? acc.pfrCount / acc.handsEligible : 0;
    const threeBet = acc.threeBetOpportunities > 0
      ? acc.threeBetCount / acc.threeBetOpportunities
      : 0;

    const avgFinishPosition = acc.results.length > 0
      ? acc.results.reduce((a, b) => a + b, 0) / acc.results.length
      : 0;

    const finishPositionStdDev = calcStdDev(acc.results, avgFinishPosition);
    const firstPlaceCount = acc.results.filter((r) => r === 1).length;
    const firstPlaceRate = acc.results.length > 0 ? firstPlaceCount / acc.results.length : 0;

    perPreset[presetName] = {
      vpip,
      pfr,
      threeBet,
      vpipTarget: preset ? preset.vpip : 0,
      pfrTarget: preset ? preset.pfr : 0,
      threeBetTarget: preset ? preset.threeBetFreq : 0,
      handsEligible: acc.handsEligible,
      threeBetOpportunities: acc.threeBetOpportunities,
      avgFinishPosition,
      finishPositionStdDev,
      firstPlaceRate,
      results: [...acc.results],
      vpipCount: acc.vpipCount,
      pfrCount: acc.pfrCount,
      threeBetCount: acc.threeBetCount,
    };
  }

  return {
    sngsCompleted,
    sngsErrored,
    perPreset,
    chipConservationPassed,
    timingMs: {
      totalMs,
      avgHandMs,
      totalHands,
    },
  };
}

// ============================================================
// Internal: run a single SNG
// ============================================================

async function runSingleSNG(
  sngSeed: string,
  playersPerSNG: number,
  presetAssignments: Record<number, string>,
  accumulators: Record<string, PresetAccumulator>,
  onChipConservation: (passed: boolean) => void,
): Promise<number> {
  // Build player names
  const playerNames: string[] = [];
  for (let i = 0; i < playersPerSNG; i++) {
    playerNames.push(`Player${i}`);
  }

  // Create tournament config with seed
  const config = createDefaultConfig({
    playerCount: playersPerSNG as 8,
    startingChips: 1500,
    handsPerLevel: 10,
    initialSeed: sngSeed,
  });

  const tournament = createTournament(config, playerNames);

  // Assign AI profiles to all players
  for (let i = 0; i < tournament.gameState.players.length; i++) {
    const player = tournament.gameState.players[i];
    if (!player) continue;
    const presetName = presetAssignments[i];
    if (!presetName) continue;

    const preset = PRESETS[presetName as PresetType];
    if (!preset) continue;

    // All players are AI (not human)
    player.isHuman = false;
    player.aiProfile = { ...preset };
  }

  // Track hands played in this SNG
  let handsPlayed = 0;

  // Pre-initialize a PRNG for action selection
  const prngState = await seedFromString(sngSeed);

  // All-AI action provider: select action for any player
  const actionProvider = async (
    playerId: string,
    _validActions: unknown,
    _bettingPlayer: unknown,
  ) => {
    const player = tournament.gameState.players.find((p: Player) => p.id === playerId);
    if (!player || !player.aiProfile) {
      return { type: 'FOLD' as const, amount: 0 };
    }

    // Use shared PRNG (deterministic per seed)
    const rng = () => nextFloat(prngState);
    const result = selectAIAction(player, tournament.gameState, null, rng);
    return { type: result.type, amount: result.amount };
  };

  // Count hands: each HAND_START event = one hand
  // Only validate chip conservation at TOURNAMENT_END (safe checkpoint)
  const countingOnEvent = (event: GameEvent) => {
    if (event.type === 'HAND_START') {
      handsPlayed++;
    }
    if (event.type === 'TOURNAMENT_END') {
      // At tournament end, all chips should be in player stacks (pots empty)
      // Use a tolerance of 1 chip for floating-point accumulation over many hands
      const { gameState, totalChips } = tournament;
      const stackSum = gameState.players.reduce((s: number, p: Player) => s + p.chips + p.currentBet, 0);
      const potSum = gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);
      const actual = stackSum + potSum;
      if (Math.abs(actual - totalChips) > 1) {
        onChipConservation(false);
      }
    }
  };

  // Run tournament
  const standings = await runTournament(tournament, actionProvider, countingOnEvent);

  // Aggregate stats from each player into their preset accumulator
  for (const player of tournament.gameState.players) {
    const presetName = presetAssignments[player.seatIndex];
    if (!presetName) continue;

    const acc = accumulators[presetName];
    if (!acc) continue;

    acc.vpipCount += player.stats.vpipCount;
    acc.pfrCount += player.stats.pfrCount;
    acc.threeBetCount += player.stats.threeBetCount;
    acc.handsEligible += player.stats.handsEligible;
    acc.threeBetOpportunities += player.stats.threeBetOpportunities;
  }

  // Record finish positions from standings
  for (const standing of standings) {
    const player = tournament.gameState.players.find((p: Player) => p.id === standing.playerId);
    if (!player) continue;

    const presetName = presetAssignments[player.seatIndex];
    if (!presetName) continue;

    const acc = accumulators[presetName];
    if (!acc) continue;

    acc.results.push(standing.position);
  }

  return handsPlayed;
}

// ============================================================
// Utility: standard deviation
// ============================================================

function calcStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sumSq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return Math.sqrt(sumSq / values.length);
}
