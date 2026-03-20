/**
 * Web Worker for running the tournament engine off the main thread.
 * Receives WorkerInMessage and posts WorkerOutMessage back to the main thread.
 */

import type { WorkerInMessage, StartGameMessage, PlayerActionMessage } from './worker-protocol';
import type { ActionResponse } from './orchestrator';
import type { ValidActionsResult } from './action-order';
import type { BettingPlayer } from './betting';
import { runTournament } from './orchestrator';
import { createTournament } from './tournament';
import { PRESETS } from '@/ai/presets';
import type { PresetType, GameEvent, GameState } from '@/types';

// Minimum and maximum AI thinking delay in milliseconds
const AI_THINK_MIN_MS = 300;
const AI_THINK_MAX_MS = 800;

// Minimum interval between STATE_UPDATE messages (throttling)
const STATE_UPDATE_THROTTLE_MS = 100;

// Pending human action resolver
let pendingActionResolver: ((response: ActionResponse) => void) | null = null;

// State update throttling
let lastStateUpdateTime = 0;

/**
 * Post a message to the main thread.
 */
function postMsg(msg: unknown): void {
  self.postMessage(msg);
}

/**
 * Post a throttled STATE_UPDATE message.
 * Always sends immediately if forceFlush is true.
 */
function postStateUpdate(state: GameState, forceFlush = false): void {
  const now = Date.now();
  if (forceFlush || now - lastStateUpdateTime >= STATE_UPDATE_THROTTLE_MS) {
    lastStateUpdateTime = now;
    postMsg({ type: 'STATE_UPDATE', state });
  }
}

/**
 * Sleep for a random duration in [min, max] ms.
 */
function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle START_GAME message: create tournament and run it.
 */
async function handleStartGame(msg: StartGameMessage): Promise<void> {
  const { config, aiProfiles } = msg;

  // Build player names: human is seat 0, AI seats 1-7
  const playerNames: string[] = ['Hero'];
  for (let i = 1; i < 8; i++) {
    const presetType = (aiProfiles[`p${i}`] ?? 'TAG') as PresetType;
    playerNames.push(`${presetType} ${i}`);
  }

  // Create tournament
  const tournament = createTournament(config, playerNames);

  // Assign AI profiles to seats 1-7
  for (let i = 1; i < tournament.gameState.players.length; i++) {
    const player = tournament.gameState.players[i];
    if (!player) continue;
    const presetKey = `p${i}`;
    const presetType = (aiProfiles[presetKey] ?? 'TAG') as PresetType;
    player.aiProfile = { ...PRESETS[presetType] };
    player.isHuman = false;
  }

  // Mark seat 0 as human
  const humanPlayer = tournament.gameState.players[0];
  if (humanPlayer) {
    humanPlayer.isHuman = true;
    humanPlayer.aiProfile = null;
  }

  // ActionProvider: called by orchestrator when a player needs to act
  const actionProvider = async (
    playerId: string,
    validActions: ValidActionsResult,
    _bettingPlayer: BettingPlayer,
  ): Promise<ActionResponse> => {
    // Find player in current state
    const player = tournament.gameState.players.find((p) => p.id === playerId);

    if (player && !player.isHuman && player.aiProfile) {
      // AI player: signal thinking, delay, then return AI action
      postMsg({ type: 'AI_THINKING', playerId });
      await randomDelay(AI_THINK_MIN_MS, AI_THINK_MAX_MS);

      // Import selectAIAction lazily (it's already bundled)
      const { selectAIAction } = await import('@/ai/action-selector');
      const actionResult = selectAIAction(player, tournament.gameState, null, Math.random);
      return { type: actionResult.type, amount: actionResult.amount };
    } else {
      // Derive valid action types from ValidActionsResult
      const validActionTypes: import('@/types').ActionType[] = [];
      if (validActions.canFold) validActionTypes.push('FOLD');
      if (validActions.canCheck) validActionTypes.push('CHECK');
      if (validActions.canCall) validActionTypes.push('CALL');
      if (validActions.canBet) validActionTypes.push('BET');
      if (validActions.canRaise) validActionTypes.push('RAISE');

      // Human player: notify main thread and wait for PLAYER_ACTION
      postMsg({
        type: 'WAITING_FOR_ACTION',
        playerId,
        validActions: validActionTypes,
        minRaise: validActions.minRaise || validActions.minBet,
        callAmount: validActions.callAmount,
      });

      return new Promise<ActionResponse>((resolve) => {
        pendingActionResolver = resolve;
      });
    }
  };

  // Event handler: forward events and throttled state updates
  const onEvent = (event: GameEvent): void => {
    postMsg({ type: 'GAME_EVENT', event });

    // Post state update (throttled, but always after HAND_COMPLETE equivalent events)
    const forceFlush =
      event.type === 'AWARD_POT' ||
      event.type === 'PLAYER_ELIMINATED' ||
      event.type === 'BLIND_LEVEL_UP' ||
      event.type === 'TOURNAMENT_END';

    postStateUpdate(tournament.gameState, forceFlush);
  };

  try {
    const standings = await runTournament(tournament, actionProvider, onEvent);

    // Always send final state after tournament ends
    postStateUpdate(tournament.gameState, true);

    // Post tournament end standings
    postMsg({ type: 'GAME_EVENT', event: {
      type: 'TOURNAMENT_END',
      timestamp: Date.now(),
      handNumber: tournament.gameState.handNumber,
      sequenceIndex: 0,
      payload: {
        type: 'TOURNAMENT_END',
        standings,
        payouts: [],
      },
    }});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    postMsg({
      type: 'GAME_ERROR',
      error: 'Tournament engine error',
      details: message,
    });
  }
}

/**
 * Handle PLAYER_ACTION message: resolve the pending human action.
 */
function handlePlayerAction(msg: PlayerActionMessage): void {
  if (pendingActionResolver) {
    const resolver = pendingActionResolver;
    pendingActionResolver = null;
    resolver({ type: msg.action, amount: msg.amount });
  }
}

/**
 * Main message handler.
 */
self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  switch (e.data.type) {
    case 'START_GAME':
      handleStartGame(e.data);
      break;
    case 'PLAYER_ACTION':
      handlePlayerAction(e.data);
      break;
    case 'RESUME_GAME':
      // Stretch goal - not implemented
      postMsg({
        type: 'GAME_ERROR',
        error: 'RESUME_GAME not implemented',
      });
      break;
  }
};
