import { describe, it, expect } from 'vitest';
import { resolveSeats, resolveHUTransition, getActionOrder } from '@/engine/seat-resolver';

describe('resolveSeats', () => {
  describe('multiway (3+ players)', () => {
    it('should assign BTN, SB, BB for first hand', () => {
      const result = resolveSeats([0, 1, 2, 3, 4, 5, 6, 7], -1);
      // First seat clockwise from -1 = seat 0
      expect(result.buttonSeat).toBe(0);
      expect(result.sbSeat).toBe(1);
      expect(result.bbSeat).toBe(2);
    });

    it('should advance button clockwise', () => {
      const result = resolveSeats([0, 1, 2, 3, 4, 5, 6, 7], 0);
      expect(result.buttonSeat).toBe(1);
      expect(result.sbSeat).toBe(2);
      expect(result.bbSeat).toBe(3);
    });

    it('should wrap around', () => {
      const result = resolveSeats([0, 1, 2, 3, 4, 5, 6, 7], 7);
      expect(result.buttonSeat).toBe(0);
      expect(result.sbSeat).toBe(1);
      expect(result.bbSeat).toBe(2);
    });

    it('should skip eliminated players', () => {
      // Seats 0,2,4,6 active (1,3,5,7 eliminated)
      const result = resolveSeats([0, 2, 4, 6], 0);
      expect(result.buttonSeat).toBe(2);
      expect(result.sbSeat).toBe(4);
      expect(result.bbSeat).toBe(6);
    });

    it('should handle 3 players', () => {
      const result = resolveSeats([1, 4, 7], 1);
      expect(result.buttonSeat).toBe(4);
      expect(result.sbSeat).toBe(7);
      expect(result.bbSeat).toBe(1);
    });
  });

  describe('heads-up (2 players)', () => {
    it('BTN = SB in HU', () => {
      const result = resolveSeats([2, 5], 2);
      expect(result.buttonSeat).toBe(5);
      expect(result.sbSeat).toBe(5); // BTN = SB
      expect(result.bbSeat).toBe(2);
    });

    it('should alternate button in HU', () => {
      const r1 = resolveSeats([0, 1], -1);
      expect(r1.buttonSeat).toBe(0);
      expect(r1.sbSeat).toBe(0);
      expect(r1.bbSeat).toBe(1);

      const r2 = resolveSeats([0, 1], r1.buttonSeat);
      expect(r2.buttonSeat).toBe(1);
      expect(r2.sbSeat).toBe(1);
      expect(r2.bbSeat).toBe(0);
    });
  });

  it('should throw with fewer than 2 players', () => {
    expect(() => resolveSeats([0], -1)).toThrow();
    expect(() => resolveSeats([], -1)).toThrow();
  });
});

describe('resolveHUTransition', () => {
  const allSeats = [0, 1, 2, 3, 4, 5, 6, 7];

  it('Case A: prev BB survives — prev BB becomes BTN/SB', () => {
    // 3 players: A=BTN(seat0), B=SB(seat1), C=BB(seat2). B eliminated.
    // Survivors: [0, 2]. Prev BB = seat 2.
    // Next surviving clockwise from BB(2): seat 0 → BB. seat 2 → BTN/SB.
    const result = resolveHUTransition([0, 2], 2, allSeats);
    expect(result.bbSeat).toBe(0); // clockwise next from prev BB
    expect(result.buttonSeat).toBe(2); // other survivor = BTN/SB
    expect(result.sbSeat).toBe(2); // HU: BTN = SB
  });

  it('Case A variant: prev BB survives, A eliminated', () => {
    // A=BTN(seat0), B=SB(seat1), C=BB(seat2). A eliminated.
    // Survivors: [1, 2]. Prev BB = seat 2.
    // Next surviving clockwise from BB(2): seat 1 → BB. seat 2 → BTN/SB.
    const result = resolveHUTransition([1, 2], 2, allSeats);
    expect(result.bbSeat).toBe(1);
    expect(result.buttonSeat).toBe(2);
    expect(result.sbSeat).toBe(2);
  });

  it('Case B: prev BB eliminated', () => {
    // A=BTN(seat0), B=SB(seat1), C=BB(seat2). C eliminated.
    // Survivors: [0, 1]. Prev BB = seat 2.
    // Next surviving clockwise from seat 2: seat 0 → BB. seat 1 → BTN/SB.
    const result = resolveHUTransition([0, 1], 2, allSeats);
    expect(result.bbSeat).toBe(0); // next surviving clockwise from seat 2
    expect(result.buttonSeat).toBe(1);
    expect(result.sbSeat).toBe(1);
  });
});

describe('getActionOrder', () => {
  it('should return seats in clockwise order from button', () => {
    const order = getActionOrder([0, 1, 2, 3, 4, 5, 6, 7], 3);
    expect(order).toEqual([3, 4, 5, 6, 7, 0, 1, 2]);
  });

  it('should work with non-consecutive seats', () => {
    const order = getActionOrder([0, 2, 5, 7], 5);
    expect(order).toEqual([5, 7, 0, 2]);
  });
});
