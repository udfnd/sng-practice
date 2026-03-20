/**
 * Main-thread manager for the game Web Worker.
 * Encapsulates worker lifecycle and message passing.
 */

import type { WorkerOutMessage } from './worker-protocol';
import type { ActionType, TournamentConfig } from '@/types';

export class WorkerManager {
  private worker: Worker | null = null;
  private messageHandler: ((msg: WorkerOutMessage) => void) | null = null;

  /**
   * Register a handler for messages from the worker.
   */
  onMessage(handler: (msg: WorkerOutMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Start a new game. Terminates any existing worker first.
   *
   * @param config Tournament configuration
   * @param aiProfiles Map of playerId (p1..p7) -> preset type string
   */
  start(config: TournamentConfig, aiProfiles: Record<string, string>): void {
    this.terminate();

    this.worker = new Worker(
      new URL('./game-worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      this.messageHandler?.(e.data);
    };

    this.worker.onerror = (e: ErrorEvent) => {
      this.messageHandler?.({
        type: 'GAME_ERROR',
        error: 'Worker error',
        details: e.message,
      });
    };

    this.worker.postMessage({ type: 'START_GAME', config, aiProfiles });
  }

  /**
   * Submit a player action to the running worker.
   */
  submitAction(playerId: string, action: ActionType, amount: number): void {
    this.worker?.postMessage({ type: 'PLAYER_ACTION', playerId, action, amount });
  }

  /**
   * Terminate the worker and clean up.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Whether a worker is currently running.
   */
  isRunning(): boolean {
    return this.worker !== null;
  }
}
