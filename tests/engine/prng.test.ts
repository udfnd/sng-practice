import { describe, it, expect } from 'vitest';
import { seedFromString, generateRandomSeed, nextUint64, nextFloat, nextInt, cloneState } from '@/engine/prng';

describe('PRNG (xoshiro256**)', () => {
  it('should produce deterministic sequence from same seed', async () => {
    const state1 = await seedFromString('test-seed-42');
    const state2 = await seedFromString('test-seed-42');

    const seq1 = Array.from({ length: 10 }, () => nextUint64(state1));
    const seq2 = Array.from({ length: 10 }, () => nextUint64(state2));

    expect(seq1).toEqual(seq2);
  });

  it('should produce different sequences from different seeds', async () => {
    const state1 = await seedFromString('seed-a');
    const state2 = await seedFromString('seed-b');

    const val1 = nextUint64(state1);
    const val2 = nextUint64(state2);

    expect(val1).not.toBe(val2);
  });

  it('should generate floats in [0, 1)', async () => {
    const state = await seedFromString('float-test');

    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(state);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('should generate integers in [0, max)', async () => {
    const state = await seedFromString('int-test');

    for (let i = 0; i < 1000; i++) {
      const n = nextInt(state, 52);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(52);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('should clone state correctly', async () => {
    const original = await seedFromString('clone-test');
    const cloned = cloneState(original);

    // Advance original
    const valOriginal = nextUint64(original);
    // Advance clone — should produce same value
    const valCloned = nextUint64(cloned);

    expect(valOriginal).toBe(valCloned);
  });

  it('cloned state should be independent', async () => {
    const original = await seedFromString('independence-test');
    const cloned = cloneState(original);

    // Advance original multiple times
    nextUint64(original);
    nextUint64(original);
    nextUint64(original);

    // Clone should still be at its original position
    const valCloned = nextUint64(cloned);
    const freshState = await seedFromString('independence-test');
    const valFresh = nextUint64(freshState);

    expect(valCloned).toBe(valFresh);
  });
});

describe('generateRandomSeed', () => {
  it('should generate a 64-character hex string', () => {
    const seed = generateRandomSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate different seeds on each call', () => {
    const seeds = new Set(Array.from({ length: 10 }, () => generateRandomSeed()));
    expect(seeds.size).toBe(10);
  });
});
