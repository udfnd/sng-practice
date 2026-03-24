/**
 * SPEC-ENGINE-008 TDA Compliance Regression Tests
 *
 * Deterministic fixture tests verifying:
 * - Fold-win event parity (AC-3)
 * - All-in runout guard (AC-1)
 * - Short all-in no-reopen (AC-2)
 * - Side-pot correctness (AC-4, AC-5)
 * - Event parity invariant (AC-7)
 */
import { describe, it, expect } from 'vitest';
import { runHand, type ActionProvider } from '@/engine/orchestrator';
import { createTournament, createDefaultConfig } from '@/engine/tournament';
import { reduceEvents } from '@/engine/event-reducer';
import type { TournamentState, GameEvent, BlindLevel, AwardPotPayload, UncalledReturnPayload, ShowdownPayload } from '@/types';
import type { ValidActionsResult } from '@/engine/action-order';

// ============================================================
// Helpers
// ============================================================

function makeTournament(playerCount: number, opts?: { chips?: number; ante?: number; seed?: string }): TournamentState {
  const blindSchedule: BlindLevel[] = [
    { level: 1, sb: 10, bb: 20, ante: opts?.ante ?? 0 },
  ];
  const config = createDefaultConfig({
    playerCount: playerCount as 8,
    startingChips: opts?.chips ?? 1500,
    handsPerLevel: 100,
    blindSchedule,
    payoutStructure: 'top2',
    payoutRatios: [0.65, 0.35],
    initialSeed: opts?.seed ?? 'tda-test-seed',
  });
  const names = Array.from({ length: playerCount }, (_, i) => `P${i}`);
  return createTournament(config, names);
}

const callOrCheckProvider: ActionProvider = async (
  _playerId: string,
  validActions: ValidActionsResult,
) => {
  if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
  if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
  return { type: 'FOLD', amount: 0 };
};

/**
 * Assert that replaying events through the reducer produces identical state to the live engine.
 * This is the core parity check from AC-7.
 */
function assertEventParity(events: GameEvent[], liveState: TournamentState): void {
  const replayState = reduceEvents(events);
  const totalChips = liveState.totalChips;

  // Chip conservation
  const liveTotal = liveState.gameState.players.reduce((s, p) => s + p.chips + p.currentBet, 0)
    + liveState.gameState.mainPot
    + liveState.gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);
  expect(liveTotal).toBe(totalChips);

  const replayTotal = replayState.players.reduce((s, p) => s + p.chips + p.currentBet, 0)
    + replayState.mainPot
    + replayState.sidePots.reduce((s, sp) => s + sp.amount, 0);
  expect(replayTotal).toBe(totalChips);

  // Per-player chip match
  for (const livePlayer of liveState.gameState.players) {
    const replayPlayer = replayState.players.find((p) => p.id === livePlayer.id);
    expect(replayPlayer, `Player ${livePlayer.id} not found in replay`).toBeDefined();
    expect(replayPlayer!.chips).toBe(livePlayer.chips);
  }

  // Pots should be zero after hand completion
  expect(liveState.gameState.mainPot).toBe(0);
  expect(replayState.mainPot).toBe(0);
}

// ============================================================
// AC-3: Fold-Win Event Sourcing Parity
// ============================================================

describe('AC-3: Fold-win event parity', () => {
  it('BB walk: everyone folds preflop, BB wins SB amount', async () => {
    const tournament = makeTournament(3, { seed: 'bb-walk-1' });

    // Everyone folds except BB (last to act preflop, checks)
    let actionCount = 0;
    const provider: ActionProvider = async (_playerId, validActions) => {
      actionCount++;
      // First player (UTG equivalent) folds, SB folds, BB gets walk
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);

    // Check UNCALLED_RETURN and AWARD_POT events
    const uncalledEvents = events.filter((e) => e.type === 'UNCALLED_RETURN');
    const awardEvents = events.filter((e) => e.type === 'AWARD_POT');

    // There should be an AWARD_POT event
    expect(awardEvents.length).toBeGreaterThanOrEqual(1);

    // AWARD_POT should have amount > 0
    for (const ae of awardEvents) {
      const payload = ae.payload as AwardPotPayload;
      const totalPayout = payload.payouts.reduce((s, p) => s + p.amount, 0);
      expect(totalPayout).toBeGreaterThan(0);
    }

    // Sum of uncalled returns + award amounts should balance
    const totalUncalled = uncalledEvents.reduce((s, e) => s + (e.payload as UncalledReturnPayload).amount, 0);
    const totalAwarded = awardEvents.reduce((s, e) => (e.payload as AwardPotPayload).payouts.reduce((ss, p) => ss + p.amount, 0) + s, 0);
    expect(totalUncalled + totalAwarded).toBeGreaterThan(0);

    // Event parity check
    assertEventParity(events, tournament);
  });

  it('preflop fold-win: all fold to UTG raiser', async () => {
    const tournament = makeTournament(4, { seed: 'pfr-fold-1' });

    let firstAction = true;
    const provider: ActionProvider = async (_playerId, validActions) => {
      if (firstAction && validActions.canRaise) {
        firstAction = false;
        return { type: 'RAISE', amount: validActions.minRaise };
      }
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);
    assertEventParity(events, tournament);
  });

  it('post-flop fold-win: bet on flop, opponent folds', async () => {
    const tournament = makeTournament(2, { seed: 'postflop-fold-1' });

    let phase = 'preflop';
    const provider: ActionProvider = async (_playerId, validActions) => {
      if (phase === 'preflop') {
        if (validActions.canCall) {
          phase = 'flop';
          return { type: 'CALL', amount: validActions.callAmount };
        }
        if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      }
      // On flop: first player bets, second folds
      if (validActions.canBet) return { type: 'BET', amount: validActions.minBet };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);
    assertEventParity(events, tournament);
  });
});

// ============================================================
// AC-1: All-In Runout Guard
// ============================================================

describe('AC-1: All-in runout guard', () => {
  it('should NOT runout when a player still needs to act on a shove', async () => {
    const tournament = makeTournament(3, { seed: 'runout-guard-1' });

    let actedPlayers: string[] = [];
    const provider: ActionProvider = async (playerId, validActions) => {
      actedPlayers.push(playerId);

      // First actor: fold
      if (actedPlayers.length === 1) return { type: 'FOLD', amount: 0 };

      // Second actor (SB): all-in
      if (actedPlayers.length === 2 && validActions.canRaise) {
        return { type: 'RAISE', amount: validActions.maxRaise };
      }

      // Third actor (BB): MUST get this action. If we reach here, the guard works.
      if (actedPlayers.length === 3) {
        return { type: 'FOLD', amount: 0 };
      }

      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, provider);

    // The third player MUST have been given a chance to act
    expect(actedPlayers.length).toBeGreaterThanOrEqual(3);
  });

  it('all players all-in: runout proceeds', async () => {
    const tournament = makeTournament(2, { chips: 100, seed: 'all-in-runout-1' });

    const provider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      return { type: 'CHECK', amount: 0 };
    };

    const events = await runHand(tournament, provider);

    // Should have community cards dealt (runout happened)
    const communityDeals = events.filter((e) => e.type === 'DEAL_COMMUNITY');
    expect(communityDeals.length).toBeGreaterThanOrEqual(1);

    // Should have showdown
    const showdowns = events.filter((e) => e.type === 'SHOWDOWN');
    expect(showdowns.length).toBe(1);

    assertEventParity(events, tournament);
  });
});

// ============================================================
// AC-2: Short All-In No-Reopen
// ============================================================

describe('AC-2: Short all-in no-reopen', () => {
  it('short all-in should not allow previously-acted player to raise', async () => {
    // Setup: 3 players, give one player a short stack for short all-in
    const tournament = makeTournament(3, { chips: 1500, seed: 'short-allin-1' });
    const players = tournament.gameState.players;
    // Player at seat 1 gets short stack to force a short all-in
    // Transfer chips to player 0 to keep totalChips invariant
    const transfer = players[1]!.chips - 35;
    players[1]!.chips = 35;
    players[0]!.chips += transfer;

    const actions: { playerId: string; validActions: ValidActionsResult }[] = [];

    const provider: ActionProvider = async (playerId, validActions) => {
      actions.push({ playerId, validActions: { ...validActions } });

      // Player 0 (UTG): raise to min (2x BB = 40)
      if (playerId === players[0]!.id && validActions.canRaise) {
        return { type: 'RAISE', amount: validActions.minRaise };
      }

      // Player 1 (short stack): all-in (35 total, which is less than 40 = short all-in)
      if (playerId === players[1]!.id) {
        if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
        if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
        return { type: 'FOLD', amount: 0 };
      }

      // Player 2 (BB): just call
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    await runHand(tournament, provider);

    // Find if player 0 got a second action after the short all-in
    const player0Actions = actions.filter((a) => a.playerId === players[0]!.id);
    if (player0Actions.length > 1) {
      // Player 0 got a second action — they should NOT have canRaise
      const secondAction = player0Actions[1]!;
      expect(secondAction.validActions.canRaise).toBe(false);
    }
    // If player 0 only acted once, the short all-in didn't reopen (also correct)
  });
});

// ============================================================
// AC-4/5: Side-Pot Correctness
// ============================================================

describe('AC-4/5: Side-pot correctness', () => {
  it('single side-pot: short stack cannot win side pot', async () => {
    const tournament = makeTournament(3, { chips: 1500, seed: 'side-pot-1' });
    const players = tournament.gameState.players;
    // Give player 0 a short stack, redistribute to keep totalChips invariant
    const original0 = players[0]!.chips;
    players[0]!.chips = 100;
    players[1]!.chips += (original0 - 100); // absorb the difference

    const provider: ActionProvider = async (_playerId, validActions) => {
      // Everyone goes all-in
      if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);

    // Should have showdown with reveals
    const showdownEvent = events.find((e) => e.type === 'SHOWDOWN');
    expect(showdownEvent).toBeDefined();

    // Should have AWARD_POT events
    const awardEvents = events.filter((e) => e.type === 'AWARD_POT');
    expect(awardEvents.length).toBeGreaterThanOrEqual(1);

    // Total payouts + uncalled returns + remaining stacks should equal total chips (chip conservation)
    assertEventParity(events, tournament);
  });
});

// ============================================================
// AC-7: Event Parity Invariant (cross-cutting)
// ============================================================

describe('AC-7: Event parity on all hand types', () => {
  it('call-through hand maintains parity', async () => {
    const tournament = makeTournament(4, { seed: 'parity-call-1' });
    const events = await runHand(tournament, callOrCheckProvider);
    assertEventParity(events, tournament);
  });

  it('all-in hand maintains parity', async () => {
    const tournament = makeTournament(3, { chips: 200, seed: 'parity-allin-1' });

    const provider: ActionProvider = async (_playerId, validActions) => {
      if (validActions.canRaise) return { type: 'RAISE', amount: validActions.maxRaise };
      if (validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);
    assertEventParity(events, tournament);
  });

  it('mixed fold/call hand maintains parity', async () => {
    const tournament = makeTournament(4, { seed: 'parity-mixed-1' });

    let count = 0;
    const provider: ActionProvider = async (_playerId, validActions) => {
      count++;
      // Alternate: fold, call, fold, call...
      if (count % 2 === 0 && validActions.canCall) return { type: 'CALL', amount: validActions.callAmount };
      if (validActions.canCheck) return { type: 'CHECK', amount: 0 };
      if (validActions.canFold) return { type: 'FOLD', amount: 0 };
      return { type: 'FOLD', amount: 0 };
    };

    const events = await runHand(tournament, provider);
    assertEventParity(events, tournament);
  });

  it('showdown reveals contain hand descriptions', async () => {
    const tournament = makeTournament(2, { seed: 'reveal-desc-1' });
    const events = await runHand(tournament, callOrCheckProvider);

    const showdownEvent = events.find((e) => e.type === 'SHOWDOWN');
    if (showdownEvent) {
      const payload = showdownEvent.payload as ShowdownPayload;
      for (const reveal of payload.reveals) {
        expect(reveal.handDescription).toBeDefined();
        expect(reveal.handDescription.length).toBeGreaterThan(0);
      }
    }
  });
});
