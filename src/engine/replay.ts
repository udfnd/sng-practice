import type {
  GameEvent,
  BlindLevel,
  AIProfile,
  ActionType,
} from '@/types';
import { runHand, type ActionProvider, type ActionResponse } from './orchestrator';
import { createTournament, createDefaultConfig } from './tournament';
import type { ValidActionsResult } from './action-order';
import type { BettingPlayer } from './betting';

// ============================================================
// Types
// ============================================================

/**
 * A single stored player action for replay.
 */
export interface StoredAction {
  playerId: string;
  action: ActionType;
  amount: number;
}

/**
 * All data needed to deterministically replay a single hand.
 */
export interface StoredHand {
  /** The deck seed used to deal hole cards and community cards. */
  seed: string;
  /** Player chip counts at the start of the hand (before blinds). */
  playerStacks: Record<string, number>;
  /** Blind level in effect for the hand. */
  blindLevel: BlindLevel;
  /** Seat assignments for all players at the table. */
  seatAssignments: {
    playerId: string;
    seatIndex: number;
    name: string;
    isHuman: boolean;
    aiProfile: AIProfile | null;
  }[];
  /** Button seat index. */
  buttonSeat: number;
  /** Ordered list of all player actions taken during the hand. */
  actions: StoredAction[];
  /** The original event sequence (for comparison). */
  events: GameEvent[];
}

/**
 * Result of comparing two event sequences.
 */
export interface ComparisonResult {
  match: boolean;
  firstDivergenceIndex: number | null;
  details: string;
}

// ============================================================
// replayHand
// ============================================================

/**
 * Deterministically replay a stored hand.
 *
 * Reconstructs a TournamentState from StoredHand, creates a replay ActionProvider
 * that pops actions from stored.actions in order, then calls runHand().
 *
 * @param stored The stored hand data to replay
 * @returns The events produced by the replay
 */
export async function replayHand(stored: StoredHand): Promise<GameEvent[]> {
  // Build player names list in seat order
  const sortedSeats = [...stored.seatAssignments].sort((a, b) => a.seatIndex - b.seatIndex);
  const playerNames = sortedSeats.map((s) => s.name);

  // Create a minimal tournament config
  const config = createDefaultConfig({
    playerCount: sortedSeats.length as 8,
    startingChips: Math.max(...Object.values(stored.playerStacks)),
    handsPerLevel: 9999,
    blindSchedule: [stored.blindLevel],
    payoutStructure: 'top3',
    payoutRatios: [0.5, 0.3, 0.2],
    // Use the stored seed so the deck is identical
    initialSeed: stored.seed,
  });

  const tournament = createTournament(config, playerNames);

  // Override player data to match stored state
  for (const seat of sortedSeats) {
    const player = tournament.gameState.players.find((p) => p.seatIndex === seat.seatIndex);
    if (player) {
      player.id = seat.playerId;
      player.name = seat.name;
      player.isHuman = seat.isHuman;
      player.aiProfile = seat.aiProfile;
      player.chips = stored.playerStacks[seat.playerId] ?? player.chips;
      player.isActive = stored.playerStacks[seat.playerId] !== undefined;
    }
  }

  // Set button position so seat resolution produces the correct SB/BB
  // We need to back-calculate the previous button seat so that after
  // transitionToResolveSeats() the new button lands on stored.buttonSeat.
  // The simplest approach: set buttonSeatIndex to the seat BEFORE the stored button.
  const activeSeats = sortedSeats
    .filter((s) => tournament.gameState.players.find((p) => p.id === s.playerId)?.isActive)
    .map((s) => s.seatIndex)
    .sort((a, b) => a - b);

  const storedButtonIdx = activeSeats.indexOf(stored.buttonSeat);
  if (storedButtonIdx >= 0) {
    // Previous button = one seat before current button in circular order
    const prevIdx = (storedButtonIdx - 1 + activeSeats.length) % activeSeats.length;
    tournament.gameState.buttonSeatIndex = activeSeats[prevIdx]!;
  }

  // Replay ActionProvider: pops from the stored actions queue
  const actionQueue = [...stored.actions];

  const replayProvider: ActionProvider = async (
    playerId: string,
    _validActions: ValidActionsResult,
    _bettingPlayer: BettingPlayer,
  ): Promise<ActionResponse> => {
    // Find the next action for this player
    const idx = actionQueue.findIndex((a) => a.playerId === playerId);
    if (idx !== -1) {
      const action = actionQueue.splice(idx, 1)[0]!;
      return { type: action.action, amount: action.amount };
    }

    // Fallback: check or fold
    return { type: 'CHECK', amount: 0 };
  };

  return runHand(tournament, replayProvider);
}

// ============================================================
// compareEventSequences
// ============================================================

/**
 * Compare two event sequences for deterministic equality.
 * Ignores timestamp (non-canonical field).
 *
 * @param original The original event sequence
 * @param replayed The replayed event sequence
 * @returns Comparison result with match status and divergence info
 */
export function compareEventSequences(
  original: GameEvent[],
  replayed: GameEvent[],
): ComparisonResult {
  // Length mismatch is a divergence
  if (original.length !== replayed.length) {
    const divergenceIndex = Math.min(original.length, replayed.length);
    return {
      match: false,
      firstDivergenceIndex: divergenceIndex,
      details: `Length mismatch: original has ${original.length} events, replayed has ${replayed.length} events`,
    };
  }

  for (let i = 0; i < original.length; i++) {
    const orig = original[i]!;
    const rep = replayed[i]!;

    // Compare type
    if (orig.type !== rep.type) {
      return {
        match: false,
        firstDivergenceIndex: i,
        details: `Divergence at index ${i}: type mismatch (${orig.type} vs ${rep.type})`,
      };
    }

    // Compare handNumber
    if (orig.handNumber !== rep.handNumber) {
      return {
        match: false,
        firstDivergenceIndex: i,
        details: `Divergence at index ${i}: handNumber mismatch (${orig.handNumber} vs ${rep.handNumber})`,
      };
    }

    // Compare payload (exclude timestamp — it's not in payload but in the event itself)
    const origPayload = JSON.stringify(orig.payload);
    const repPayload = JSON.stringify(rep.payload);
    if (origPayload !== repPayload) {
      return {
        match: false,
        firstDivergenceIndex: i,
        details: `Divergence at index ${i} (${orig.type}): payload mismatch`,
      };
    }
  }

  return {
    match: true,
    firstDivergenceIndex: null,
    details: '',
  };
}
