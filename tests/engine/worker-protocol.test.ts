import { describe, it, expect } from 'vitest';
import type {
  StartGameMessage,
  PlayerActionMessage,
  ResumeGameMessage,
  GameEventMessage,
  StateUpdateMessage,
  AIThinkingMessage,
  GameErrorMessage,
  WaitingForActionMessage,
} from '@/engine/worker-protocol';

describe('Worker Protocol Types', () => {
  it('should create valid StartGameMessage', () => {
    const msg: StartGameMessage = {
      type: 'START_GAME',
      config: {
        playerCount: 8,
        startingChips: 1500,
        handsPerLevel: 10,
        blindSchedule: [{ level: 1, sb: 10, bb: 20, ante: 5 }],
        payoutStructure: 'top3',
        payoutRatios: [0.5, 0.3, 0.2],
        initialSeed: null,
      },
      aiProfiles: { 'p1': 'TAG', 'p2': 'LAG' },
    };
    expect(msg.type).toBe('START_GAME');
    expect(msg.config.playerCount).toBe(8);
  });

  it('should create valid PlayerActionMessage', () => {
    const msg: PlayerActionMessage = {
      type: 'PLAYER_ACTION',
      playerId: 'p0',
      action: 'RAISE',
      amount: 200,
    };
    expect(msg.type).toBe('PLAYER_ACTION');
    expect(msg.action).toBe('RAISE');
  });

  it('should create valid ResumeGameMessage', () => {
    const msg: ResumeGameMessage = {
      type: 'RESUME_GAME',
      snapshotJson: '{}',
    };
    expect(msg.type).toBe('RESUME_GAME');
  });

  it('should create valid worker output messages', () => {
    const eventMsg: GameEventMessage = {
      type: 'GAME_EVENT',
      event: {
        type: 'HAND_START',
        timestamp: Date.now(),
        handNumber: 1,
        sequenceIndex: 0,
        payload: { type: 'HAND_START', handNumber: 1, seed: 's', blindLevel: { level: 1, sb: 10, bb: 20, ante: 5 }, buttonSeat: 0, sbSeat: 1, bbSeat: 2, stacks: [] },
      },
    };
    expect(eventMsg.type).toBe('GAME_EVENT');

    const stateMsg: StateUpdateMessage = {
      type: 'STATE_UPDATE',
      state: {} as any,
    };
    expect(stateMsg.type).toBe('STATE_UPDATE');

    const thinkMsg: AIThinkingMessage = {
      type: 'AI_THINKING',
      playerId: 'p1',
    };
    expect(thinkMsg.type).toBe('AI_THINKING');

    const errorMsg: GameErrorMessage = {
      type: 'GAME_ERROR',
      error: 'Something went wrong',
      details: 'Stack trace here',
    };
    expect(errorMsg.type).toBe('GAME_ERROR');

    const waitMsg: WaitingForActionMessage = {
      type: 'WAITING_FOR_ACTION',
      playerId: 'p0',
      validActions: ['FOLD', 'CALL', 'RAISE'],
      minRaise: 200,
      callAmount: 100,
    };
    expect(waitMsg.type).toBe('WAITING_FOR_ACTION');
    expect(waitMsg.validActions).toHaveLength(3);
  });

  it('all messages should be structured-cloneable (no functions/classes)', () => {
    const msg: StartGameMessage = {
      type: 'START_GAME',
      config: {
        playerCount: 8,
        startingChips: 1500,
        handsPerLevel: 10,
        blindSchedule: [{ level: 1, sb: 10, bb: 20, ante: 5 }],
        payoutStructure: 'top3',
        payoutRatios: [0.5, 0.3, 0.2],
        initialSeed: 'test',
      },
      aiProfiles: {},
    };

    // Verify JSON round-trip (proxy for structured clone safety)
    const serialized = JSON.stringify(msg);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.type).toBe('START_GAME');
    expect(deserialized.config.playerCount).toBe(8);
  });
});
