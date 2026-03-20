import { describe, it, expect } from 'vitest';
import { getPositionGroup, isHeadsUp } from '@/ai/position';

describe('getPositionGroup', () => {
  describe('8-player table', () => {
    const seats = [0, 1, 2, 3, 4, 5, 6, 7];

    it('should map BTN correctly (relPos 0)', () => {
      expect(getPositionGroup(seats, 3, 3)).toBe('BTN');
    });

    it('should map SB correctly (relPos 1)', () => {
      expect(getPositionGroup(seats, 4, 3)).toBe('SB');
    });

    it('should map BB correctly (relPos 2)', () => {
      expect(getPositionGroup(seats, 5, 3)).toBe('BB');
    });

    it('should map EP1 correctly (relPos 3)', () => {
      expect(getPositionGroup(seats, 6, 3)).toBe('EP');
    });

    it('should map EP2 to EP group (relPos 4)', () => {
      expect(getPositionGroup(seats, 7, 3)).toBe('EP');
    });

    it('should map MP correctly (relPos 5-6)', () => {
      expect(getPositionGroup(seats, 0, 3)).toBe('MP');
      expect(getPositionGroup(seats, 1, 3)).toBe('MP');
    });

    it('should map CO correctly (relPos 7)', () => {
      expect(getPositionGroup(seats, 2, 3)).toBe('CO');
    });
  });

  describe('6-player table', () => {
    const seats = [0, 1, 2, 3, 4, 5];

    it('should map positions correctly', () => {
      // Button=0: BTN(0), SB(1), BB(2), MP(3), CO(4), CO(5)
      expect(getPositionGroup(seats, 0, 0)).toBe('BTN');
      expect(getPositionGroup(seats, 1, 0)).toBe('SB');
      expect(getPositionGroup(seats, 2, 0)).toBe('BB');
      expect(getPositionGroup(seats, 3, 0)).toBe('MP');
      expect(getPositionGroup(seats, 4, 0)).toBe('CO');
      expect(getPositionGroup(seats, 5, 0)).toBe('CO');
    });
  });

  describe('3-player table', () => {
    it('should map BTN, SB, BB', () => {
      const seats = [1, 4, 7];
      expect(getPositionGroup(seats, 4, 4)).toBe('BTN');
      expect(getPositionGroup(seats, 7, 4)).toBe('SB');
      expect(getPositionGroup(seats, 1, 4)).toBe('BB');
    });
  });

  describe('heads-up (2 players)', () => {
    it('BTN = BTN position', () => {
      expect(getPositionGroup([0, 1], 0, 0)).toBe('BTN');
    });

    it('non-BTN = BB position', () => {
      expect(getPositionGroup([0, 1], 1, 0)).toBe('BB');
    });
  });

  it('should handle non-consecutive seats', () => {
    // 4 players at seats 0, 2, 5, 7. Button at 5.
    const seats = [0, 2, 5, 7];
    expect(getPositionGroup(seats, 5, 5)).toBe('BTN');
    expect(getPositionGroup(seats, 7, 5)).toBe('SB');
    expect(getPositionGroup(seats, 0, 5)).toBe('BB');
    expect(getPositionGroup(seats, 2, 5)).toBe('CO');
  });
});

describe('isHeadsUp', () => {
  it('should return true for 2 players', () => {
    expect(isHeadsUp(2)).toBe(true);
  });

  it('should return false for 3+ players', () => {
    expect(isHeadsUp(3)).toBe(false);
    expect(isHeadsUp(8)).toBe(false);
  });
});
