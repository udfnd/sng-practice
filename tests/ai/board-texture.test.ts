import { describe, it, expect } from 'vitest';
import { analyzeBoardTexture, textureAdjustment } from '@/ai/board-texture';
import { toEncoded, fromEncoded } from '@/engine/card';
import type { Card, Suit } from '@/types';

function card(notation: string): Card {
  const rankMap: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const suitMap: Record<string, Suit> = { 's': 'spades', 'h': 'hearts', 'd': 'diamonds', 'c': 'clubs' };
  return fromEncoded(toEncoded(suitMap[notation.slice(-1)]!, rankMap[notation.slice(0, -1)]! as any));
}

describe('analyzeBoardTexture', () => {
  it('should detect dry board (disconnected, rainbow)', () => {
    expect(analyzeBoardTexture([card('Ah'), card('7d'), card('2c')])).toBe('dry');
  });

  it('should detect wet board (connected + flush draw)', () => {
    expect(analyzeBoardTexture([card('9h'), card('8h'), card('7d')])).toBe('wet');
  });

  it('should detect monotone board (3+ same suit)', () => {
    expect(analyzeBoardTexture([card('Ah'), card('9h'), card('4h')])).toBe('monotone');
  });

  it('should detect paired board', () => {
    expect(analyzeBoardTexture([card('Ks'), card('Kh'), card('7d')])).toBe('paired');
  });

  it('should handle less than 3 cards', () => {
    expect(analyzeBoardTexture([card('As'), card('Kh')])).toBe('dry');
  });
});

describe('textureAdjustment', () => {
  it('dry boards increase C-bet frequency', () => {
    expect(textureAdjustment('dry')).toBeGreaterThan(0);
  });

  it('wet boards decrease C-bet frequency', () => {
    expect(textureAdjustment('wet')).toBeLessThan(0);
  });
});
