import { describe, it, expect } from 'vitest';
import {
  getNashPushRange,
  getNashCallRange,
  type PositionGroup,
} from '@/ai/nash-tables';

describe('Nash Push Range Tables', () => {
  describe('BTN push range is wider than EP at same stack depth', () => {
    it('should push wider from BTN than EP at 5BB', () => {
      const btnRange = getNashPushRange(5, 'BTN', 0, false);
      const epRange = getNashPushRange(5, 'EP', 0, false);
      expect(btnRange).toBeGreaterThan(epRange);
    });

    it('should push wider from BTN than EP at 8BB', () => {
      const btnRange = getNashPushRange(8, 'BTN', 0, false);
      const epRange = getNashPushRange(8, 'EP', 0, false);
      expect(btnRange).toBeGreaterThan(epRange);
    });

    it('should push wider from CO than EP at 6BB', () => {
      const coRange = getNashPushRange(6, 'CO', 0, false);
      const epRange = getNashPushRange(6, 'EP', 0, false);
      expect(coRange).toBeGreaterThan(epRange);
    });
  });

  describe('SB push range is very wide at short stacks', () => {
    it('should push very wide from SB at 1BB', () => {
      const sbRange = getNashPushRange(1, 'SB', 0, false);
      expect(sbRange).toBeGreaterThanOrEqual(0.95);
    });

    it('should push wide from SB at 3BB', () => {
      const sbRange = getNashPushRange(3, 'SB', 0, false);
      expect(sbRange).toBeGreaterThan(0.6);
    });

    it('SB push range is wider than EP at 4BB', () => {
      const sbRange = getNashPushRange(4, 'SB', 0, false);
      const epRange = getNashPushRange(4, 'EP', 0, false);
      expect(sbRange).toBeGreaterThan(epRange);
    });
  });

  describe('Push range narrows as stack deepens', () => {
    const positions: PositionGroup[] = ['BTN', 'CO', 'MP', 'EP', 'SB'];

    for (const pos of positions) {
      it(`${pos} push range should decrease from 3BB to 10BB`, () => {
        const range3 = getNashPushRange(3, pos, 0, false);
        const range6 = getNashPushRange(6, pos, 0, false);
        const range10 = getNashPushRange(10, pos, 0, false);
        expect(range3).toBeGreaterThan(range6);
        expect(range6).toBeGreaterThan(range10);
      });
    }

    it('BTN range monotonically decreasing from 1BB to 15BB', () => {
      const stacks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
      const ranges = stacks.map((s) => getNashPushRange(s, 'BTN', 0, false));
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i]).toBeLessThanOrEqual(ranges[i - 1]!);
      }
    });
  });

  describe('Ante widens push range by approximately 15%', () => {
    it('BTN push range with ante is wider than without at 6BB', () => {
      const withAnte = getNashPushRange(6, 'BTN', 0, true);
      const withoutAnte = getNashPushRange(6, 'BTN', 0, false);
      expect(withAnte).toBeGreaterThan(withoutAnte);
      // The ante multiplier is 1.15, so roughly 10-20% wider (clamped to 1.0)
      expect(withAnte / withoutAnte).toBeGreaterThanOrEqual(1.05);
    });

    it('EP push range with ante widens at 8BB', () => {
      const withAnte = getNashPushRange(8, 'EP', 0, true);
      const withoutAnte = getNashPushRange(8, 'EP', 0, false);
      expect(withAnte).toBeGreaterThan(withoutAnte);
    });
  });

  describe('Players-to-act shrinks range', () => {
    it('BTN range shrinks with more players to act', () => {
      const alone = getNashPushRange(6, 'BTN', 0, false);
      const twoLeft = getNashPushRange(6, 'BTN', 2, false);
      const fiveLeft = getNashPushRange(6, 'BTN', 5, false);
      expect(alone).toBeGreaterThan(twoLeft);
      expect(twoLeft).toBeGreaterThan(fiveLeft);
    });

    it('each additional player reduces range by ~15%', () => {
      const base = getNashPushRange(5, 'BTN', 0, false);
      const oneExtra = getNashPushRange(5, 'BTN', 1, false);
      // Ratio should be close to 0.85
      expect(oneExtra / base).toBeCloseTo(0.85, 1);
    });
  });

  describe('Range interpolation between table rows', () => {
    it('4.5BB range should be between 4BB and 5BB', () => {
      const at4 = getNashPushRange(4, 'BTN', 0, false);
      const at5 = getNashPushRange(5, 'BTN', 0, false);
      const at4_5 = getNashPushRange(4.5, 'BTN', 0, false);
      expect(at4_5).toBeLessThan(at4);
      expect(at4_5).toBeGreaterThan(at5);
    });

    it('7.5BB range should be between 7BB and 8BB for CO', () => {
      const at7 = getNashPushRange(7, 'CO', 0, false);
      const at8 = getNashPushRange(8, 'CO', 0, false);
      const at7_5 = getNashPushRange(7.5, 'CO', 0, false);
      expect(at7_5).toBeLessThan(at7);
      expect(at7_5).toBeGreaterThan(at8);
    });
  });

  describe('Edge cases', () => {
    it('0.5BB stack should return near-max push range', () => {
      const range = getNashPushRange(0.5, 'BTN', 0, false);
      expect(range).toBeCloseTo(1.0, 1);
    });

    it('15+BB stack should return small push range', () => {
      const range = getNashPushRange(20, 'EP', 0, false);
      expect(range).toBeLessThan(0.05);
    });

    it('All ranges are between 0 and 1', () => {
      const positions: PositionGroup[] = ['BTN', 'CO', 'MP', 'EP', 'SB'];
      const stacks = [0.5, 1, 3, 5, 8, 10, 15, 20];
      for (const pos of positions) {
        for (const stack of stacks) {
          const range = getNashPushRange(stack, pos, 0, false);
          expect(range).toBeGreaterThanOrEqual(0);
          expect(range).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Reference values from Nash table', () => {
    it('BTN at 8BB should be approximately 0.25', () => {
      expect(getNashPushRange(8, 'BTN', 0, false)).toBeCloseTo(0.25, 1);
    });

    it('EP at 8BB should be approximately 0.08', () => {
      expect(getNashPushRange(8, 'EP', 0, false)).toBeCloseTo(0.08, 1);
    });

    it('SB at 5BB should be approximately 0.48', () => {
      expect(getNashPushRange(5, 'SB', 0, false)).toBeCloseTo(0.48, 1);
    });
  });
});

describe('Nash Call Range', () => {
  describe('Call range is tighter than push range at same depth', () => {
    it('call range at 6BB should be less than push range at 6BB', () => {
      const pushRange = getNashPushRange(6, 'BTN', 0, false);
      const callRange = getNashCallRange(6, 12, 2.0);
      expect(callRange).toBeLessThan(pushRange);
    });

    it('call range at 8BB should be less than push range at 8BB', () => {
      const pushRange = getNashPushRange(8, 'BTN', 0, false);
      const callRange = getNashCallRange(8, 16, 2.0);
      expect(callRange).toBeLessThan(pushRange);
    });
  });

  describe('Call range is based on pot odds', () => {
    it('better pot odds leads to wider call range', () => {
      // Higher potOdds ratio (e.g., 3:1) should lead to wider call range
      const goodOdds = getNashCallRange(6, 12, 3.0);   // 3:1 odds
      const badOdds = getNashCallRange(6, 12, 1.0);    // 1:1 odds
      expect(goodOdds).toBeGreaterThan(badOdds);
    });

    it('deeper stack leads to tighter call range', () => {
      const shallow = getNashCallRange(4, 8, 2.0);
      const deep = getNashCallRange(10, 20, 2.0);
      expect(shallow).toBeGreaterThan(deep);
    });
  });

  describe('Call range edge cases', () => {
    it('call range is always >= 0', () => {
      const range = getNashCallRange(10, 20, 1.0);
      expect(range).toBeGreaterThanOrEqual(0);
    });

    it('call range is always <= 1', () => {
      const range = getNashCallRange(1, 2, 3.0);
      expect(range).toBeLessThanOrEqual(1);
    });
  });
});
