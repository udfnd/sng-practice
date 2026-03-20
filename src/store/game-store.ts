import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GameState, ActionType, TournamentConfig } from '@/types';

interface GameStore {
  /** Current game state (null if not started) */
  gameState: GameState | null;
  /** Whether it's the human player's turn */
  isHumanTurn: boolean;
  /** Whether the tournament is in progress */
  isPlaying: boolean;
  /** Tournament configuration */
  config: TournamentConfig | null;
  /** Action log messages */
  actionLog: string[];

  /** Update the game state from worker events */
  updateGameState: (state: GameState) => void;
  /** Set human turn flag */
  setHumanTurn: (value: boolean) => void;
  /** Send a player action */
  sendAction: (action: ActionType, amount: number) => void;
  /** Start a new game */
  startGame: (config: TournamentConfig) => void;
  /** Add to action log */
  addLog: (message: string) => void;
  /** Reset store */
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    gameState: null,
    isHumanTurn: false,
    isPlaying: false,
    config: null,
    actionLog: [],

    updateGameState: (state) =>
      set((draft) => {
        draft.gameState = state;
      }),

    setHumanTurn: (value) =>
      set((draft) => {
        draft.isHumanTurn = value;
      }),

    sendAction: (action, amount) => {
      // Will be connected to worker bridge
      set((draft) => {
        draft.isHumanTurn = false;
        draft.addLog(`You: ${action}${amount > 0 ? ` ${amount}` : ''}`);
      });
    },

    startGame: (config) =>
      set((draft) => {
        draft.config = config;
        draft.isPlaying = true;
        draft.actionLog = [];
      }),

    addLog: (message) =>
      set((draft) => {
        draft.actionLog.push(message);
        if (draft.actionLog.length > 100) {
          draft.actionLog = draft.actionLog.slice(-50);
        }
      }),

    reset: () =>
      set((draft) => {
        draft.gameState = null;
        draft.isHumanTurn = false;
        draft.isPlaying = false;
        draft.config = null;
        draft.actionLog = [];
      }),
  })),
);
