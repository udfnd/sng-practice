import { describe, it, expect } from 'vitest';
import { HAND_RANGE_TABLE, getHandPercentile, handClassName } from '@/ai/hand-ranges';

describe('Hand Range Table', () => {
  it('should have exactly 169 hand classes', () => {
    expect(HAND_RANGE_TABLE).toHaveLength(169);
  });

  it('should have unique hand names', () => {
    const names = HAND_RANGE_TABLE.map((h) => h.name);
    expect(new Set(names).size).toBe(169);
  });

  it('should have total combos = 1326', () => {
    const total = HAND_RANGE_TABLE.reduce((sum, h) => sum + h.combos, 0);
    expect(total).toBe(1326);
  });

  it('pairs should have 6 combos', () => {
    const pairs = HAND_RANGE_TABLE.filter((h) => !h.name.endsWith('s') && !h.name.endsWith('o') && h.name.length === 2);
    for (const p of pairs) {
      expect(p.combos).toBe(6);
    }
    expect(pairs).toHaveLength(13);
  });

  it('suited hands should have 4 combos', () => {
    const suited = HAND_RANGE_TABLE.filter((h) => h.name.endsWith('s'));
    for (const s of suited) {
      expect(s.combos).toBe(4);
    }
    expect(suited).toHaveLength(78);
  });

  it('offsuit hands should have 12 combos', () => {
    const offsuit = HAND_RANGE_TABLE.filter((h) => h.name.endsWith('o'));
    for (const o of offsuit) {
      expect(o.combos).toBe(12);
    }
    expect(offsuit).toHaveLength(78);
  });

  it('AA should have the lowest (best) percentile', () => {
    const aa = HAND_RANGE_TABLE.find((h) => h.name === 'AA')!;
    expect(aa).toBeDefined();
    // AA should be in the top ~0.5% (6/1326)
    expect(aa.percentiles.EP).toBeLessThan(0.01);
  });

  it('top 10% should be approximately 133 combos', () => {
    // Count combos where percentile ≤ 0.10
    let combos = 0;
    for (const h of HAND_RANGE_TABLE) {
      if (h.percentiles.CO <= 0.10) {
        combos += h.combos;
      }
    }
    // Should be roughly ~133 ± some margin
    expect(combos).toBeGreaterThan(80);
    expect(combos).toBeLessThan(200);
  });

  it('BTN ranges should be wider than EP ranges', () => {
    // For a mid-strength hand, BTN percentile should be lower (more playable)
    const hand = HAND_RANGE_TABLE.find((h) => h.name === 'KTs')!;
    expect(hand.percentiles.BTN).toBeLessThan(hand.percentiles.EP);
  });

  it('HU ranges should be widest', () => {
    const hand = HAND_RANGE_TABLE.find((h) => h.name === 'T9s')!;
    expect(hand.percentiles.HU).toBeLessThan(hand.percentiles.EP);
  });
});

describe('getHandPercentile', () => {
  it('should return percentile for AA in EP', () => {
    const pct = getHandPercentile(14, 14, false, 'EP');
    expect(pct).toBeLessThan(0.01);
  });

  it('should return percentile for AKs in CO', () => {
    const pct = getHandPercentile(14, 13, true, 'CO');
    expect(pct).toBeLessThan(0.10); // AKs is a top ~6% hand
  });

  it('should throw for invalid hand', () => {
    expect(() => getHandPercentile(15, 14, false, 'EP')).toThrow();
  });
});

describe('handClassName', () => {
  it('should format pairs correctly', () => {
    expect(handClassName(14, 14, false)).toBe('AA');
    expect(handClassName(2, 2, false)).toBe('22');
  });

  it('should format suited correctly', () => {
    expect(handClassName(14, 13, true)).toBe('AKs');
  });

  it('should format offsuit correctly', () => {
    expect(handClassName(14, 13, false)).toBe('AKo');
  });

  it('should auto-sort high/low', () => {
    expect(handClassName(13, 14, true)).toBe('AKs'); // low, high → sorted
  });
});
