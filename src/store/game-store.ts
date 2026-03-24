import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { GameState, ActionType, TournamentConfig, Standing, TournamentState, GameEvent } from '@/types';
import type { DisplayMode } from '@/utils/format-chips';
import { loadDisplayMode, saveDisplayMode } from '@/utils/format-chips';
import { WorkerManager } from '@/engine/worker-manager';
import type { WorkerOutMessage } from '@/engine/worker-protocol';
import { formatEvent } from '@/engine/event-formatter';
import { saveHand } from '@/storage/hand-history-store';
import { saveSnapshot, loadSnapshot, deleteSnapshot } from '@/storage/session-store';
import { exportData as exportAllData, importData as importAllData } from '@/storage/export-import';
import { clearAllHands } from '@/storage/hand-history-store';
import type { StoredHand } from '@/engine/replay';

// Module-level WorkerManager instance (not stored in Zustand state)
let workerManager: WorkerManager | null = null;

function getWorkerManager(): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager();
  }
  return workerManager;
}

interface GameStore {
  /** Current game state (null if not started) */
  gameState: GameState | null;
  /** Whether it's the human player's turn */
  isHumanTurn: boolean;
  /** ID of the AI player currently "thinking" (null if none) */
  thinkingPlayerId: string | null;
  /** Valid action types for the human player during their turn */
  validActions: ActionType[];
  /** Minimum raise-to amount */
  minRaise: number;
  /** Amount needed to call */
  callAmount: number;
  /** Action log messages */
  actionLog: string[];
  /** Whether the tournament is in progress */
  isPlaying: boolean;
  /** Tournament configuration */
  config: TournamentConfig | null;
  /** Error message (null if none) */
  error: string | null;
  /** Final standings (null until tournament ends) */
  standings: Standing[] | null;
  /** Current human player ID */
  humanPlayerId: string | null;
  /** Whether a resumable session exists */
  hasResumableSession: boolean;
  /** Resumable tournament state (null if none) */
  resumableState: TournamentState | null;
  /** Player IDs who won the pot in the most recent showdown */
  showdownWinners: string[];
  /** Last action per player for the current street (cleared on new street/hand) */
  playerLastAction: Record<string, { action: ActionType; amount: number }>;
  /** Accumulated events for the current hand */
  _currentHandEvents: GameEvent[];

  /** Start a new game with the given config and AI profiles */
  startGame: (config: TournamentConfig, aiProfiles: Record<string, string>) => void;
  /** Submit a human player action */
  submitAction: (action: ActionType, amount: number) => void;
  /** Handle a message from the worker */
  handleWorkerMessage: (msg: WorkerOutMessage) => void;
  /** Reset all state and terminate worker */
  resetGame: () => void;

  /** Save completed hand to history and update session snapshot */
  saveHandToHistory: (events: GameEvent[], metadata: Partial<StoredHand>) => Promise<void>;
  /** Save the current tournament snapshot */
  saveSessionSnapshot: () => Promise<void>;
  /** Check storage for a resumable session (call on app mount) */
  checkForResumableSession: () => Promise<void>;
  /** Resume the stored game */
  resumeGame: () => void;
  /** Decline resume and clear the snapshot */
  declineResume: () => Promise<void>;
  /** Export all data as a file download */
  exportData: () => Promise<void>;
  /** Import data from a file */
  importData: (file: File) => Promise<{ success: boolean; error?: string }>;
  /** Reset all storage data */
  resetAllData: () => Promise<void>;

  /** Current chip display mode */
  displayMode: DisplayMode;
  /** Toggle between 'chips' and 'bb' display modes */
  toggleDisplayMode: () => void;

  // Legacy compatibility
  updateGameState: (state: GameState) => void;
  setHumanTurn: (value: boolean) => void;
  sendAction: (action: ActionType, amount: number) => void;
  addLog: (message: string) => void;
  reset: () => void;
}

const initialState = {
  gameState: null,
  isHumanTurn: false,
  thinkingPlayerId: null,
  validActions: [] as ActionType[],
  minRaise: 0,
  callAmount: 0,
  actionLog: [] as string[],
  isPlaying: false,
  config: null,
  error: null,
  standings: null,
  humanPlayerId: null,
  hasResumableSession: false,
  resumableState: null as TournamentState | null,
  showdownWinners: [] as string[],
  playerLastAction: {} as Record<string, { action: ActionType; amount: number }>,
  _currentHandEvents: [] as GameEvent[],
  displayMode: loadDisplayMode() as DisplayMode,
};

export const useGameStore = create<GameStore>()(
  immer((set, get) => ({
    ...initialState,

    startGame: (config, aiProfiles) => {
      console.log('[GameStore] startGame called', { config, aiProfiles });
      set((draft) => {
        Object.assign(draft, { ...initialState, isPlaying: true, config });
      });

      const manager = getWorkerManager();
      manager.onMessage((msg) => {
        console.log('[GameStore] Worker message:', msg.type);
        get().handleWorkerMessage(msg);
      });
      manager.start(config, aiProfiles);
      console.log('[GameStore] Worker started');
    },

    submitAction: (action, amount) => {
      const { humanPlayerId } = get();
      if (!humanPlayerId) return;

      set((draft) => {
        draft.isHumanTurn = false;
        draft.validActions = [];
      });

      getWorkerManager().submitAction(humanPlayerId, action, amount);
    },

    handleWorkerMessage: (msg) => {
      set((draft) => {
        switch (msg.type) {
          case 'STATE_UPDATE': {
            const prevPhase = draft.gameState?.phase;
            draft.gameState = msg.state;

            // Detect human player ID from game state
            const human = msg.state.players.find((p) => p.isHuman);
            if (human && !draft.humanPlayerId) {
              draft.humanPlayerId = human.id;
            }

            // On hand completion: save hand history + session snapshot
            if (msg.state.phase === 'HAND_COMPLETE' && prevPhase !== 'HAND_COMPLETE') {
              const eventsSnapshot = [...draft._currentHandEvents];
              draft._currentHandEvents = [];
              // Fire-and-forget async saves (outside immer draft)
              void Promise.resolve().then(async () => {
                try {
                  await get().saveHandToHistory(eventsSnapshot, {});
                  await get().saveSessionSnapshot();
                } catch (err) {
                  console.warn('[GameStore] Failed to save hand/session:', err);
                }
              });
            }

            break;
          }

          case 'WAITING_FOR_ACTION': {
            draft.isHumanTurn = true;
            draft.thinkingPlayerId = null;
            draft.validActions = msg.validActions;
            draft.minRaise = msg.minRaise;
            draft.callAmount = msg.callAmount;
            break;
          }

          case 'AI_THINKING': {
            draft.thinkingPlayerId = msg.playerId;
            draft.isHumanTurn = false;
            break;
          }

          case 'GAME_EVENT': {
            const event = msg.event;

            // Accumulate events for hand history
            draft._currentHandEvents.push(event);

            // Build player name map for log formatting
            const playersList = draft.gameState?.players;
            const nameEntries: [string, string][] = [];
            if (playersList) {
              for (let i = 0; i < playersList.length; i++) {
                const p = playersList[i];
                if (p) nameEntries.push([p.id, p.name]);
              }
            }
            const nameMap = new Map<string, string>(nameEntries);

            // Format and add to action log (only significant events)
            const line = formatEvent(event, nameMap);
            if (line !== null) {
              draft.actionLog.push(line);
              if (draft.actionLog.length > 200) {
                draft.actionLog = draft.actionLog.slice(-100);
              }
            }

            // Track player last action for UI display (check, call, raise, etc.)
            if (event.type === 'PLAYER_ACTION') {
              const p = event.payload;
              if (p.type === 'PLAYER_ACTION') {
                draft.playerLastAction[p.playerId] = { action: p.action, amount: p.amount };
              }
            }

            // Clear last actions on new street (community cards dealt) or new hand
            if (event.type === 'DEAL_COMMUNITY' || event.type === 'HAND_START') {
              draft.playerLastAction = {};
            }

            // Track pot winners for UI display
            if (event.type === 'AWARD_POT') {
              const payload = event.payload;
              if (payload.type === 'AWARD_POT') {
                const winnerIds = payload.payouts.map((pw) => pw.playerId);
                for (const wid of winnerIds) {
                  if (!draft.showdownWinners.includes(wid)) {
                    draft.showdownWinners.push(wid);
                  }
                }
              }
            }

            // Clear winners when new hand starts
            if (event.type === 'HAND_START') {
              draft.showdownWinners = [];
            }

            // Handle tournament end
            if (event.type === 'TOURNAMENT_END') {
              const payload = event.payload;
              if (payload.type === 'TOURNAMENT_END') {
                draft.standings = payload.standings;
                draft.isPlaying = false;
                draft.isHumanTurn = false;
                draft.thinkingPlayerId = null;
                void deleteSnapshot();
              }
            }

            break;
          }

          case 'GAME_ERROR': {
            draft.error = `${msg.error}${msg.details ? `: ${msg.details}` : ''}`;
            draft.isPlaying = false;
            draft.isHumanTurn = false;
            draft.thinkingPlayerId = null;
            break;
          }
        }
      });
    },

    resetGame: () => {
      getWorkerManager().terminate();
      set((draft) => {
        Object.assign(draft, initialState);
      });
    },

    saveHandToHistory: async (events, metadata) => {
      const { config, gameState } = get();
      if (!config || !gameState) return;

      const hand: StoredHand & { id: string; savedAt: number } = {
        id: `hand-${gameState.handNumber}-${Date.now()}`,
        savedAt: Date.now(),
        seed: gameState.seed,
        playerStacks: Object.fromEntries(
          gameState.players.map((p) => [p.id, p.chips]),
        ),
        blindLevel: gameState.blindLevel,
        seatAssignments: gameState.players.map((p) => ({
          playerId: p.id,
          seatIndex: p.seatIndex,
          name: p.name,
          isHuman: p.isHuman,
          aiProfile: p.aiProfile,
        })),
        buttonSeat: gameState.buttonSeatIndex,
        actions: [],
        events,
        ...metadata,
      };

      // Deep-clone via JSON to ensure IndexedDB structured cloning compatibility.
      // Immer drafts or non-cloneable references in events/state can cause DataCloneError.
      const sanitizedHand = JSON.parse(JSON.stringify(hand));

      await saveHand(sanitizedHand);
    },

    saveSessionSnapshot: async () => {
      const { config, gameState } = get();
      if (!config || !gameState) return;

      // Build a minimal TournamentState from current game state for snapshot
      const snapshot: TournamentState = {
        tournamentId: `tournament-${Date.now()}`,
        config,
        gameState,
        eliminations: [],
        standings: [],
        isComplete: false,
        currentBlindLevelIndex: gameState.blindLevel.level - 1,
        totalChips: config.startingChips * config.playerCount,
      };

      await saveSnapshot(snapshot);
    },

    checkForResumableSession: async () => {
      const state = await loadSnapshot();
      set((draft) => {
        draft.hasResumableSession = state !== null;
        draft.resumableState = state;
      });
    },

    resumeGame: () => {
      const { resumableState } = get();
      if (!resumableState) return;
      set((draft) => {
        draft.gameState = resumableState.gameState;
        draft.config = resumableState.config;
        draft.isPlaying = true;
        draft.hasResumableSession = false;
        draft.resumableState = null;
      });
    },

    declineResume: async () => {
      await deleteSnapshot();
      set((draft) => {
        draft.hasResumableSession = false;
        draft.resumableState = null;
      });
    },

    exportData: async () => {
      await exportAllData();
    },

    importData: async (file) => {
      const result = await importAllData(file);
      return { success: result.success, error: result.error };
    },

    resetAllData: async () => {
      await clearAllHands();
      await deleteSnapshot();
      get().resetGame();
    },

    // Legacy compatibility methods
    updateGameState: (state) =>
      set((draft) => {
        draft.gameState = state;
      }),

    setHumanTurn: (value) =>
      set((draft) => {
        draft.isHumanTurn = value;
      }),

    sendAction: (action, amount) => {
      get().submitAction(action, amount);
    },

    addLog: (message) =>
      set((draft) => {
        draft.actionLog.push(message);
        if (draft.actionLog.length > 100) {
          draft.actionLog = draft.actionLog.slice(-50);
        }
      }),

    reset: () => get().resetGame(),

    toggleDisplayMode: () => {
      set((draft) => {
        const next: DisplayMode = draft.displayMode === 'chips' ? 'bb' : 'chips';
        draft.displayMode = next;
        saveDisplayMode(next);
      });
    },
  })),
);
