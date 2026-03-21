/**
 * Tests for Milestone 1: Enhanced Board Texture (BoardTextureDetail)
 * RED phase — all tests should fail until implementation is complete.
 */
import { describe, it, expect } from 'vitest';
import type { Card } from '@/types';
import { analyzeBoardTexture, textureAdjustment, type BoardTextureDetail } from '@/ai/board-texture';

function makeCard(
  rank: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
): Card {
  const suitIndex = ['spades', 'hearts', 'diamonds', 'clubs'].indexOf(suit);
  return { encoded: suitIndex * 13 + (rank - 2), suit, rank };
}

// ============================================================
// BoardTextureDetail return type
// ============================================================

describe('analyzeBoardTexture - returns BoardTextureDetail', () => {
  it('returns object with category, flushComplete, straightComplete fields', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    // Should be an object (not a string) with detailed fields
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('flushComplete');
    expect(result).toHaveProperty('straightComplete');
    expect(result).toHaveProperty('highCardCount');
    expect(result).toHaveProperty('pairedCount');
    expect(result).toHaveProperty('maxSuitCount');
    expect(result).toHaveProperty('connectivity');
  });

  it('category is dry for A-7-2 rainbow', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.category).toBe('dry');
  });

  it('category is wet for 9-8-7 with flush draw', () => {
    const result = analyzeBoardTexture([
      makeCard(9, 'spades'),
      makeCard(8, 'hearts'),
      makeCard(7, 'spades'),
    ]);
    expect(result.category).toBe('wet');
  });

  it('category is monotone for A-9-4 all hearts', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'hearts'),
      makeCard(9, 'hearts'),
      makeCard(4, 'hearts'),
    ]);
    expect(result.category).toBe('monotone');
  });

  it('category is paired for K-K-7', () => {
    const result = analyzeBoardTexture([
      makeCard(13, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(7, 'diamonds'),
    ]);
    expect(result.category).toBe('paired');
  });
});

describe('BoardTextureDetail - flushComplete', () => {
  it('flushComplete is true when 3+ cards are same suit (monotone flop)', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'hearts'),
      makeCard(9, 'hearts'),
      makeCard(4, 'hearts'),
    ]);
    expect(result.flushComplete).toBe(true);
  });

  it('flushComplete is false when only 2 cards are same suit (flush draw)', () => {
    const result = analyzeBoardTexture([
      makeCard(9, 'spades'),
      makeCard(8, 'spades'),
      makeCard(7, 'hearts'),
    ]);
    expect(result.flushComplete).toBe(false);
  });

  it('flushComplete is false for rainbow board', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.flushComplete).toBe(false);
  });

  it('flushComplete is true on turn/river with 4+ same suit', () => {
    // Turn: 4 cards, 3 spades
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(9, 'spades'),
      makeCard(4, 'spades'),
      makeCard(2, 'hearts'),
    ]);
    expect(result.flushComplete).toBe(true);
  });
});

describe('BoardTextureDetail - straightComplete', () => {
  it('straightComplete is true for 5-6-7 (three in sequence)', () => {
    const result = analyzeBoardTexture([
      makeCard(5, 'spades'),
      makeCard(6, 'hearts'),
      makeCard(7, 'clubs'),
    ]);
    expect(result.straightComplete).toBe(true);
  });

  it('straightComplete is false for A-7-2 disconnected', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.straightComplete).toBe(false);
  });

  it('straightComplete is true for 5-6-7-8 turn board', () => {
    const result = analyzeBoardTexture([
      makeCard(5, 'spades'),
      makeCard(6, 'hearts'),
      makeCard(7, 'clubs'),
      makeCard(8, 'diamonds'),
    ]);
    expect(result.straightComplete).toBe(true);
  });
});

describe('BoardTextureDetail - highCardCount', () => {
  it('counts J+ cards as high cards', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'), // A
      makeCard(13, 'hearts'), // K
      makeCard(7, 'clubs'),
    ]);
    expect(result.highCardCount).toBe(2);
  });

  it('Q is a high card (J+ threshold)', () => {
    const result = analyzeBoardTexture([
      makeCard(12, 'spades'), // Q
      makeCard(11, 'hearts'), // J
      makeCard(2, 'clubs'),
    ]);
    expect(result.highCardCount).toBe(2);
  });

  it('low board has 0 high cards', () => {
    const result = analyzeBoardTexture([
      makeCard(2, 'spades'),
      makeCard(5, 'hearts'),
      makeCard(8, 'clubs'),
    ]);
    expect(result.highCardCount).toBe(0);
  });
});

describe('BoardTextureDetail - pairedCount', () => {
  it('pairedCount is 1 for K-K-7 board', () => {
    const result = analyzeBoardTexture([
      makeCard(13, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(7, 'diamonds'),
    ]);
    expect(result.pairedCount).toBe(1);
  });

  it('pairedCount is 0 for unpaired board', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.pairedCount).toBe(0);
  });

  it('pairedCount is 2 for K-K-7-7 board (double paired)', () => {
    const result = analyzeBoardTexture([
      makeCard(13, 'spades'),
      makeCard(13, 'hearts'),
      makeCard(7, 'diamonds'),
      makeCard(7, 'clubs'),
    ]);
    expect(result.pairedCount).toBe(2);
  });
});

describe('BoardTextureDetail - maxSuitCount', () => {
  it('maxSuitCount is 3 for monotone flop', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'hearts'),
      makeCard(9, 'hearts'),
      makeCard(4, 'hearts'),
    ]);
    expect(result.maxSuitCount).toBe(3);
  });

  it('maxSuitCount is 2 for flush draw', () => {
    const result = analyzeBoardTexture([
      makeCard(9, 'spades'),
      makeCard(8, 'spades'),
      makeCard(7, 'hearts'),
    ]);
    expect(result.maxSuitCount).toBe(2);
  });

  it('maxSuitCount is 1 for rainbow', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.maxSuitCount).toBe(1);
  });
});

describe('BoardTextureDetail - connectivity', () => {
  it('connectivity is 1.0 for highly connected board (5-6-7)', () => {
    const result = analyzeBoardTexture([
      makeCard(5, 'spades'),
      makeCard(6, 'hearts'),
      makeCard(7, 'clubs'),
    ]);
    expect(result.connectivity).toBeGreaterThanOrEqual(0.8);
  });

  it('connectivity is low for disconnected board (A-7-2)', () => {
    const result = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    expect(result.connectivity).toBeLessThanOrEqual(0.2);
  });

  it('connectivity is between 0 and 1', () => {
    const boards = [
      [makeCard(9, 'spades'), makeCard(8, 'hearts'), makeCard(7, 'clubs')],
      [makeCard(14, 'spades'), makeCard(7, 'hearts'), makeCard(2, 'clubs')],
      [makeCard(5, 'spades'), makeCard(6, 'hearts'), makeCard(8, 'clubs')],
    ];
    for (const board of boards) {
      const result = analyzeBoardTexture(board);
      expect(result.connectivity).toBeGreaterThanOrEqual(0);
      expect(result.connectivity).toBeLessThanOrEqual(1);
    }
  });
});

describe('textureAdjustment - accepts BoardTextureDetail', () => {
  it('textureAdjustment works with detail.category', () => {
    const detail = analyzeBoardTexture([
      makeCard(14, 'spades'),
      makeCard(7, 'hearts'),
      makeCard(2, 'clubs'),
    ]);
    // textureAdjustment should accept category string
    const adj = textureAdjustment(detail.category);
    expect(typeof adj).toBe('number');
    expect(adj).toBeGreaterThan(0); // dry board
  });
});
