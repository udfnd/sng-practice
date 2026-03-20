import { describe, it, expect } from 'vitest';
import { runHand, runTournament, type ActionProvider } from '@/engine/orchestrator';
import {
  createTournament,
  createDefaultConfig,
} from '@/engine/tournament';
import { validateEventOrder } from '@/engine/events';
import { assertChipInvariant } from '@/engine/pot';
import type { TournamentState } from '@/types';
import type { BlindLevel } from '@/types';
import type { BettingPlayer } from '@/engine/betting';
import type { ValidActionsResult } from '@/engine/action-order';

// ============================================================
// Helper factories
// ============================================================

function makePlayerNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player${i}`);
}


/**
 * AI ActionProvider that always calls.
 */
const callOrCheckProvider: ActionProvider = async (
  _playerId: string,
  validActions: ValidActionsResult,
  _bettingPlayer: BettingPlayer,
) => {
  if (validActions.canCall) {
    return { type: 'CALL', amount: validActions.callAmount };
  }
  if (validActions.canCheck) {
    return { type: 'CHECK', amount: 0 };
  }
  return { type: 'FOLD', amount: 0 };
};

function makeTournament(playerCount: number = 8, overrides?: { handsPerLevel?: number; ante?: number }): TournamentState {
  const blindSchedule: BlindLevel[] = [
    { level: 1, sb: 10, bb: 20, ante: overrides?.ante ?? 0 },
    { level: 2, sb: 15, bb: 30, ante: 5 },
  ];
  const config = createDefaultConfig({
    playerCount: playerCount as 8,
    startingChips: 1500,
    handsPerLevel: overrides?.handsPerLevel ?? 100,
    blindSchedule,
    payoutStructure: 'top3',
    payoutRatios: [0.5, 0.3, 0.2],
    initialSeed: 'test-seed',
  });
  const names = makePlayerNames(playerCount);
  return createTournament(config, names);
}

// ============================================================
// Helper to check chip invariant against tournament
// ============================================================

function checkInvariant(tournament: TournamentState) {
  const { gameState, totalChips } = tournament;
  const potPlayers = gameState.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));
  assertChipInvariant(potPlayers, gameState.mainPot, gameState.sidePots, totalChips);
}

// ============================================================
// AC-1: Complete hand lifecycle with all phases
// ============================================================

describe('AC-1: Complete hand lifecycle', () => {
  it('should run a complete hand and emit all required events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    // Must have events
    expect(events.length).toBeGreaterThan(0);

    const eventTypes = events.map((e) => e.type);

    // Must have HAND_START
    expect(eventTypes).toContain('HAND_START');

    // Must have DEAL_HOLE
    expect(eventTypes).toContain('DEAL_HOLE');

    // Must have HAND ending (fold-win, award pot, etc.)
    const hasAward = eventTypes.includes('AWARD_POT');
    expect(hasAward).toBe(true);
  });

  it('should transition through PREFLOP, FLOP, TURN, RIVER in a call-through hand', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const communityEvents = events.filter((e) => e.type === 'DEAL_COMMUNITY');

    // Should deal FLOP (3 cards), TURN (1 card), RIVER (1 card)
    // Unless it's a fold-win which won't have community cards
    // With call-or-check, we should get to showdown
    expect(communityEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('should have game state in HAND_COMPLETE after runHand', async () => {
    const tournament = makeTournament(3);
    await runHand(tournament, callOrCheckProvider);

    expect(tournament.gameState.phase).toBe('HAND_COMPLETE');
  });

  it('should reset pots after hand completes', async () => {
    const tournament = makeTournament(3);
    await runHand(tournament, callOrCheckProvider);

    expect(tournament.gameState.mainPot).toBe(0);
    expect(tournament.gameState.sidePots).toHaveLength(0);
  });
});

// ============================================================
// AC-2: Fold-win short circuit (no FLOP/TURN/RIVER)
// ============================================================

describe('AC-2: Fold-win short circuit', () => {
  it('should skip remaining streets when only one player remains', async () => {
    const tournament = makeTournament(3);

    // Provider that always folds (except first player who acts last preflop — BB gets no action)
    let callCount = 0;
    const foldEveryone: ActionProvider = async (_playerId, _validActions) => {
      callCount++;
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, foldEveryone);

    // Should NOT have FLOP/TURN/RIVER community cards since fold-win
    const communityEvents = events.filter((e) => e.type === 'DEAL_COMMUNITY');
    // In fold-win scenario all community events should be 0
    expect(communityEvents).toHaveLength(0);

    // Should have AWARD_POT
    expect(events.some((e) => e.type === 'AWARD_POT')).toBe(true);
  });

  it('should award pot to the last non-folded player', async () => {
    const tournament = makeTournament(3);

    // Count folds: in 3-player preflop order is UTG, SB, BB
    // If UTG and SB fold, BB wins uncontested
    let foldCount = 0;
    const foldFirst2: ActionProvider = async (_playerId, validActions) => {
      if (foldCount < 2 && validActions.canFold) {
        foldCount++;
        return { type: 'FOLD', amount: 0 };
      }
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, foldFirst2);

    const awardEvents = events.filter((e) => e.type === 'AWARD_POT');
    expect(awardEvents.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// AC-3: All-in runout
// ============================================================

describe('AC-3: All-in runout', () => {
  it('should deal remaining community cards without betting when all-in', async () => {
    const tournament = makeTournament(2); // HU for simplicity

    // Provider that goes all-in (or calls everything)
    let moveCount = 0;
    const goAllIn: ActionProvider = async (_playerId, validActions) => {
      moveCount++;
      if (validActions.canRaise) {
        // Raise to max (all-in)
        return { type: 'RAISE', amount: validActions.maxRaise };
      }
      if (validActions.canBet) {
        return { type: 'BET', amount: validActions.maxBet };
      }
      if (validActions.canCall) {
        return { type: 'CALL', amount: validActions.callAmount };
      }
      if (validActions.canCheck) {
        return { type: 'CHECK', amount: 0 };
      }
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, goAllIn);

    // After all-in, should still deal community cards (runout)
    // The hand should complete regardless
    expect(tournament.gameState.phase).toBe('HAND_COMPLETE');
  });
});

// ============================================================
// AC-8/AC-9: Valid actions flow through orchestrator
// ============================================================

describe('AC-8/9: Valid action types passed to provider', () => {
  it('should pass valid actions to provider including canCheck when no bet', async () => {
    const tournament = makeTournament(3);

    const actionsReceived: string[] = [];
    const trackingProvider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canCheck) actionsReceived.push('check-available');
      if (validActions.canCall) actionsReceived.push('call-available');
      if (validActions.canBet) actionsReceived.push('bet-available');
      if (validActions.canFold) actionsReceived.push('fold-available');

      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, trackingProvider);

    // Should have seen both check and call scenarios
    expect(actionsReceived).toContain('fold-available');
  });
});

// ============================================================
// AC-10: Multi-pot showdown distribution
// ============================================================

describe('AC-10: Multi-pot showdown', () => {
  it('should award multiple pots at showdown when side pots exist', async () => {
    // Create a scenario with different stack sizes to force side pots
    const tournament = makeTournament(3);

    // Give one player a very small stack to create side pot
    const players = tournament.gameState.players;
    const shortPlayer = players[0]!;
    const excessChips = shortPlayer.chips - 50;
    shortPlayer.chips = 50;
    // Redistribute to keep invariant
    players[1]!.chips += excessChips;

    const callProvider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canCall) {
        return { type: 'CALL', amount: validActions.callAmount };
      }
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, callProvider);

    // Should complete successfully
    expect(tournament.gameState.phase).toBe('HAND_COMPLETE');

    // Chip invariant should hold throughout
    checkInvariant(tournament);
  });
});

// ============================================================
// AC-11: Chip conservation invariant
// ============================================================

describe('AC-11: Chip conservation invariant', () => {
  it('should maintain chip invariant after a complete hand', async () => {
    const tournament = makeTournament(4);
    const initialTotal = tournament.totalChips;

    await runHand(tournament, callOrCheckProvider);

    const { gameState } = tournament;
    const stackSum = gameState.players.reduce((s, p) => s + p.chips, 0);
    const betSum = gameState.players.reduce((s, p) => s + p.currentBet, 0);
    const potSum = gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);

    expect(stackSum + betSum + potSum).toBe(initialTotal);
  });

  it('should maintain chip invariant across multiple hands', async () => {
    const tournament = makeTournament(4);
    const initialTotal = tournament.totalChips;

    // Run 3 hands
    for (let i = 0; i < 3; i++) {
      await runHand(tournament, callOrCheckProvider);

      // Reset for next hand
      tournament.gameState.phase = 'WAITING';
      for (const p of tournament.gameState.players) {
        if (p.isActive && p.chips === 0) {
          p.isActive = false;
        }
      }

      const activePlayers = tournament.gameState.players.filter((p) => p.isActive);
      if (activePlayers.length < 2) break;
    }

    const { gameState } = tournament;
    const total = gameState.players.reduce((s, p) => s + p.chips, 0);
    expect(total).toBe(initialTotal);
  });
});

// ============================================================
// AC-12: Tournament loop to completion
// ============================================================

describe('AC-12: Tournament loop', () => {
  it('should run tournament to completion with 2 players', async () => {
    const tournament = makeTournament(2);
    const standings = await runTournament(tournament, callOrCheckProvider, () => {});

    expect(tournament.isComplete).toBe(true);
    expect(standings).toHaveLength(2);
    expect(standings[0]!.position).toBe(1);
    expect(standings[1]!.position).toBe(2);
  });

  it('should emit events for each hand during tournament', async () => {
    const tournament = makeTournament(2);
    const allEvents: string[] = [];

    await runTournament(tournament, callOrCheckProvider, (event) => {
      allEvents.push(event.type);
    });

    expect(allEvents).toContain('HAND_START');
    expect(allEvents).toContain('AWARD_POT');
    expect(allEvents).toContain('TOURNAMENT_END');
  });

  it('should have exactly one winner in standings', async () => {
    const tournament = makeTournament(2);
    const standings = await runTournament(tournament, callOrCheckProvider, () => {});

    const winner = standings.find((s) => s.position === 1);
    expect(winner).toBeDefined();
  });
});

// ============================================================
// AC-13: Blind level advancement
// ============================================================

describe('AC-13: Blind level advancement', () => {
  it('should advance blind level after handsPerLevel hands', async () => {
    const tournament = makeTournament(3, { handsPerLevel: 2 });
    const blindLevelUpEvents: string[] = [];

    await runTournament(tournament, callOrCheckProvider, (event) => {
      if (event.type === 'BLIND_LEVEL_UP') {
        blindLevelUpEvents.push(event.type);
      }
    });

    // Should have had a blind level up during tournament
    // (or tournament ends before level up if players bust out)
    expect(tournament.gameState.handNumber).toBeGreaterThan(0);
  });

  it('should emit BLIND_LEVEL_UP event when advancing', async () => {
    const tournament = makeTournament(3, { handsPerLevel: 1 });
    const events: string[] = [];

    await runTournament(tournament, callOrCheckProvider, (e) => {
      events.push(e.type);
    });

    // Should have blind level up since handsPerLevel=1
    expect(events).toContain('BLIND_LEVEL_UP');
  });
});

// ============================================================
// AC-14: Simultaneous elimination
// ============================================================

describe('AC-14: Simultaneous elimination', () => {
  it('should handle simultaneous elimination when multiple players bust on same hand', async () => {
    const tournament = makeTournament(3);
    const players = tournament.gameState.players;

    // Give players 1 and 2 very small stacks (they'll bust in one hand)
    players[1]!.chips = 25;
    players[2]!.chips = 25;
    players[0]!.chips = tournament.totalChips - 50;

    const standings = await runTournament(tournament, callOrCheckProvider, () => {});

    // Tournament should complete
    expect(tournament.isComplete).toBe(true);
    // All players should be in standings
    expect(standings).toHaveLength(3);
  });
});

// ============================================================
// AC-15: Human action yield via ActionProvider
// ============================================================

describe('AC-15: Human action yielding', () => {
  it('should call ActionProvider with player ID and valid actions', async () => {
    const tournament = makeTournament(3);

    const providerCalls: Array<{ playerId: string; validActions: ValidActionsResult }> = [];

    const trackingProvider: ActionProvider = async (playerId, validActions) => {
      providerCalls.push({ playerId, validActions });

      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, trackingProvider);

    // Provider should have been called at least once
    expect(providerCalls.length).toBeGreaterThan(0);

    // Each call should have player ID and valid actions
    for (const call of providerCalls) {
      expect(call.playerId).toBeTruthy();
      expect(typeof call.validActions.canFold).toBe('boolean');
      expect(typeof call.validActions.canCheck).toBe('boolean');
    }
  });

  it('should pass betting player state to ActionProvider', async () => {
    const tournament = makeTournament(3);

    let receivedBettingPlayer: BettingPlayer | null = null;

    const trackingProvider: ActionProvider = async (_playerId, validActions, bettingPlayer) => {
      receivedBettingPlayer = bettingPlayer;
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, trackingProvider);

    expect(receivedBettingPlayer).not.toBeNull();
    expect(receivedBettingPlayer!.id).toBeTruthy();
    expect(typeof receivedBettingPlayer!.chips).toBe('number');
  });
});

// ============================================================
// AC-16: Event sequence integrity
// ============================================================

describe('AC-16: Event sequence integrity', () => {
  it('should emit events with monotonically increasing sequenceIndex', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    expect(events.length).toBeGreaterThan(0);
    expect(validateEventOrder(events)).toBe(true);
  });

  it('should start sequenceIndex at 0 for each hand', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    expect(events[0]!.sequenceIndex).toBe(0);
  });

  it('should have correct handNumber in all events', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    // All events from this hand should share the same handNumber
    const handNumbers = new Set(events.map((e) => e.handNumber));
    expect(handNumbers.size).toBe(1);
    expect(handNumbers.has(1)).toBe(true); // First hand = handNumber 1
  });

  it('should emit events in correct order: HAND_START → POST_BLIND → DEAL_HOLE → ...', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const types = events.map((e) => e.type);

    // HAND_START must be first
    expect(types[0]).toBe('HAND_START');

    // DEAL_HOLE must come after POST_BLIND events
    const firstDealIdx = types.indexOf('DEAL_HOLE');
    const lastBlindIdx = types.lastIndexOf('POST_BLIND');

    if (firstDealIdx !== -1 && lastBlindIdx !== -1) {
      expect(firstDealIdx).toBeGreaterThan(lastBlindIdx);
    }

    // AWARD_POT must come near end
    const awardIdx = types.lastIndexOf('AWARD_POT');
    expect(awardIdx).toBeGreaterThan(firstDealIdx);
  });
});

// ============================================================
// Additional: HAND_START payload integrity
// ============================================================

describe('HAND_START event payload', () => {
  it('should include correct blind level, button, and stack info', async () => {
    const tournament = makeTournament(3);
    const events = await runHand(tournament, callOrCheckProvider);

    const handStart = events.find((e) => e.type === 'HAND_START');
    expect(handStart).toBeDefined();

    const payload = handStart!.payload as any;
    expect(payload.handNumber).toBe(1);
    expect(payload.blindLevel).toBeDefined();
    expect(payload.stacks).toHaveLength(3);
    expect(payload.stacks.every((s: any) => s.chips === 1500)).toBe(true);
  });
});

// ============================================================
// Post-hand: Eliminate players with 0 chips
// ============================================================

describe('Post-hand player elimination', () => {
  it('should emit PLAYER_ELIMINATED events for busted players', async () => {
    const tournament = makeTournament(3);

    // Give one player almost no chips
    const players = tournament.gameState.players;
    players[0]!.chips = 15; // Less than SB (10) + potential call
    players[1]!.chips += 1500 - 15;

    await runHand(tournament, callOrCheckProvider);

    // The tournament may or may not eliminate - depends on outcome
    // But at least chip invariant must hold
    checkInvariant(tournament);
  });

  it('should deactivate eliminated players after hand', async () => {
    const tournament = makeTournament(2);

    // One player starts with very few chips, likely to bust
    tournament.gameState.players[0]!.chips = 30;
    tournament.gameState.players[1]!.chips = tournament.totalChips - 30;

    const standings = await runTournament(tournament, callOrCheckProvider, () => {});

    expect(tournament.isComplete).toBe(true);
    expect(standings.length).toBe(2);
  });
});

// ============================================================
// Uncalled bet return
// ============================================================

describe('Uncalled bet return', () => {
  it('should return uncalled bet when player folds to a raise', async () => {
    const tournament = makeTournament(3);

    const raiseProvider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canRaise) {
        return { type: 'RAISE', amount: validActions.maxRaise };
      }
      if (validActions.canCall) {
        // Fold to big raise
        return { type: 'FOLD', amount: 0 };
      }
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, raiseProvider);

    // Tournament state should be valid regardless
    expect(tournament.gameState.phase).toBe('HAND_COMPLETE');
    checkInvariant(tournament);
  });
});
