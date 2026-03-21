/**
 * Web Worker for running the tournament engine off the main thread.
 * Receives WorkerInMessage and posts WorkerOutMessage back to the main thread.
 */

import type { WorkerInMessage, StartGameMessage, PlayerActionMessage } from './worker-protocol';
import type { ActionResponse, OnRunoutStreetDealt } from './orchestrator';
import type { ValidActionsResult } from './action-order';
import type { BettingPlayer } from './betting';
import { runTournament } from './orchestrator';
import type { Street } from '@/types';
import { createTournament } from './tournament';
import { PRESETS } from '@/ai/presets';
import type { PresetType, GameEvent, GameState } from '@/types';

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
 * Handle START_GAME message: create tournament and run it.
 */
async function handleStartGame(msg: StartGameMessage): Promise<void> {
  console.log('[Worker] handleStartGame called');
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

  // ActionProvider: called by orchestrator ONLY for human players.
  // AI players are handled internally by the orchestrator with a seeded PRNG.
  const actionProvider = async (
    playerId: string,
    validActions: ValidActionsResult,
    _bettingPlayer: BettingPlayer,
  ): Promise<ActionResponse> => {
    // Derive valid action types from ValidActionsResult
    const validActionTypes: import('@/types').ActionType[] = [];
    if (validActions.canFold) validActionTypes.push('FOLD');
    if (validActions.canCheck) validActionTypes.push('CHECK');
    if (validActions.canCall) validActionTypes.push('CALL');
    if (validActions.canBet) validActionTypes.push('BET');
    if (validActions.canRaise) validActionTypes.push('RAISE');

    // Flush any pending events and send current state before asking human to act
    flushPendingEvents();
    postStateUpdate(tournament.gameState, true);

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
  };

  // AI delay hook: called before each AI action to give users time to see the state.
  // We flush pending events and update state first, then wait 1500ms.
  const AI_ACTION_DELAY_MS = 1500;
  const onBeforeAIAction = async (playerId: string): Promise<void> => {
    flushPendingEvents();
    postStateUpdate(tournament.gameState, true);
    postMsg({ type: 'AI_THINKING', playerId });
    await new Promise<void>((resolve) => setTimeout(resolve, AI_ACTION_DELAY_MS));
  };

  // All-in runout delay: flush events and wait between each street deal
  const RUNOUT_STREET_DELAY_MS = 2000;
  const onRunoutStreetDealt: OnRunoutStreetDealt = async (_street: Street): Promise<void> => {
    flushPendingEvents();
    postStateUpdate(tournament.gameState, true);
    await new Promise<void>((resolve) => setTimeout(resolve, RUNOUT_STREET_DELAY_MS));
  };

  // Batch events between meaningful checkpoints to avoid flooding main thread
  let pendingEvents: GameEvent[] = [];

  function flushPendingEvents(): void {
    if (pendingEvents.length === 0) return;
    // Send batched events
    for (const event of pendingEvents) {
      postMsg({ type: 'GAME_EVENT', event });
    }
    pendingEvents = [];
    // Send state update after flush
    postStateUpdate(tournament.gameState, true);
  }

  // Event handler: batch events and flush at checkpoints
  const onEvent = (event: GameEvent): void => {
    pendingEvents.push(event);

    // Flush at meaningful checkpoints
    const isCheckpoint =
      event.type === 'AWARD_POT' ||
      event.type === 'PLAYER_ELIMINATED' ||
      event.type === 'BLIND_LEVEL_UP' ||
      event.type === 'TOURNAMENT_END' ||
      event.type === 'DEAL_COMMUNITY';

    if (isCheckpoint) {
      flushPendingEvents();
    }
  };

  try {
    console.log('[Worker] Starting runTournament...');
    await runTournament(tournament, actionProvider, onEvent, onBeforeAIAction, onRunoutStreetDealt);

    // Flush remaining events and send final state.
    // NOTE: runTournament already emits TOURNAMENT_END via onEvent, which is
    // flushed here. Do NOT post a second TOURNAMENT_END — that would cause the
    // store to process standings twice and corrupt the results screen routing.
    flushPendingEvents();
    postStateUpdate(tournament.gameState, true);
  } catch (err) {
    console.error('[Worker] Tournament error:', err);
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
