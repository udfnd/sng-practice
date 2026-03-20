import type { GameEvent, GameState, TournamentConfig, ActionType } from '@/types';

// ========== Main Thread → Worker Messages ==========

export interface StartGameMessage {
  type: 'START_GAME';
  config: TournamentConfig;
  aiProfiles: Record<string, string>; // playerId → presetType
}

export interface PlayerActionMessage {
  type: 'PLAYER_ACTION';
  playerId: string;
  action: ActionType;
  amount: number;
}

export interface ResumeGameMessage {
  type: 'RESUME_GAME';
  snapshotJson: string;
}

export type WorkerInMessage = StartGameMessage | PlayerActionMessage | ResumeGameMessage;

// ========== Worker → Main Thread Messages ==========

export interface GameEventMessage {
  type: 'GAME_EVENT';
  event: GameEvent;
}

export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  state: GameState;
}

export interface AIThinkingMessage {
  type: 'AI_THINKING';
  playerId: string;
}

export interface GameErrorMessage {
  type: 'GAME_ERROR';
  error: string;
  details?: string;
}

export interface WaitingForActionMessage {
  type: 'WAITING_FOR_ACTION';
  playerId: string;
  validActions: ActionType[];
  minRaise: number;
  callAmount: number;
}

export type WorkerOutMessage =
  | GameEventMessage
  | StateUpdateMessage
  | AIThinkingMessage
  | GameErrorMessage
  | WaitingForActionMessage;
