import { describe, it, expect } from 'vitest';
import { formatAmount, bbToChips, chipsToBB } from '../../src/utils/format-chips';

describe('formatAmount', () => {
  describe('chips mode', () => {
    it('formats zero', () => {
      expect(formatAmount(0, 20, 'chips')).toBe('0');
    });

    it('formats a small integer', () => {
      expect(formatAmount(100, 20, 'chips')).toBe('100');
    });

    it('formats a large integer with locale separator', () => {
      // toLocaleString inserts commas for thousands in en-US
      const result = formatAmount(10000, 20, 'chips');
      expect(result).toMatch(/10[,.]?000/);
    });

    it('ignores bb value in chips mode', () => {
      expect(formatAmount(200, 1, 'chips')).toBe('200');
      expect(formatAmount(200, 999, 'chips')).toBe('200');
    });
  });

  describe('bb mode', () => {
    it('formats zero as "0 BB"', () => {
      expect(formatAmount(0, 20, 'bb')).toBe('0 BB');
    });

    it('formats exact whole BB amounts without decimal', () => {
      expect(formatAmount(20, 20, 'bb')).toBe('1 BB');
      expect(formatAmount(40, 20, 'bb')).toBe('2 BB');
      expect(formatAmount(200, 20, 'bb')).toBe('10 BB');
    });

    it('formats fractional BB with 1 decimal place', () => {
      expect(formatAmount(10, 20, 'bb')).toBe('0.5 BB');
      expect(formatAmount(30, 20, 'bb')).toBe('1.5 BB');
      expect(formatAmount(50, 20, 'bb')).toBe('2.5 BB');
    });

    it('formats large stacks in BB', () => {
      // 1500 chips at bb=20 => 75 BB
      expect(formatAmount(1500, 20, 'bb')).toBe('75 BB');
    });

    it('handles non-standard bb sizes', () => {
      // bb = 100
      expect(formatAmount(250, 100, 'bb')).toBe('2.5 BB');
      expect(formatAmount(300, 100, 'bb')).toBe('3 BB');
    });

    it('falls back to chip format when bb is 0', () => {
      // bb=0 guard: should use chips display to avoid division by zero
      expect(formatAmount(100, 0, 'bb')).toBe('100');
    });
  });
});

describe('bbToChips', () => {
  it('converts whole BB to chips', () => {
    expect(bbToChips(1, 20)).toBe(20);
    expect(bbToChips(2, 20)).toBe(40);
    expect(bbToChips(10, 20)).toBe(200);
  });

  it('converts fractional BB with rounding', () => {
    expect(bbToChips(2.5, 20)).toBe(50);
    expect(bbToChips(0.5, 20)).toBe(10);
  });

  it('rounds to nearest integer', () => {
    // 2.5 * 15 = 37.5, rounds to 38
    expect(bbToChips(2.5, 15)).toBe(38);
  });

  it('handles zero', () => {
    expect(bbToChips(0, 20)).toBe(0);
  });

  it('handles large values', () => {
    expect(bbToChips(100, 200)).toBe(20000);
  });
});

describe('chipsToBB', () => {
  it('converts chips to BB', () => {
    expect(chipsToBB(20, 20)).toBe(1);
    expect(chipsToBB(40, 20)).toBe(2);
    expect(chipsToBB(10, 20)).toBe(0.5);
  });

  it('preserves fractional values', () => {
    expect(chipsToBB(50, 20)).toBe(2.5);
    expect(chipsToBB(30, 20)).toBe(1.5);
  });

  it('handles zero chips', () => {
    expect(chipsToBB(0, 20)).toBe(0);
  });

  it('is the inverse of bbToChips for clean values', () => {
    const bb = 20;
    const bbAmt = 2.5;
    const chips = bbToChips(bbAmt, bb);
    expect(chipsToBB(chips, bb)).toBe(bbAmt);
  });
});
