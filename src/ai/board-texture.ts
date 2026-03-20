import type { Card } from '@/types';

export type BoardTexture = 'dry' | 'wet' | 'monotone' | 'paired';

/**
 * Analyze board texture from community cards.
 */
export function analyzeBoardTexture(communityCards: Card[]): BoardTexture {
  if (communityCards.length < 3) return 'dry';

  const suits = communityCards.map((c) => c.suit);
  const ranks = communityCards.map((c) => c.rank);

  // Check monotone (3+ same suit)
  const suitCounts = new Map<string, number>();
  for (const s of suits) {
    suitCounts.set(s, (suitCounts.get(s) ?? 0) + 1);
  }
  const maxSuitCount = Math.max(...suitCounts.values());
  if (maxSuitCount >= 3) return 'monotone';

  // Check paired
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }
  if ([...rankCounts.values()].some((c) => c >= 2)) return 'paired';

  // Check connectivity (wet vs dry)
  const sorted = [...ranks].sort((a, b) => a - b);
  let connections = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1]! - sorted[i]!;
    if (gap <= 2) connections++;
  }

  // Flush draws possible?
  const hasFlushDraw = maxSuitCount >= 2;

  if (connections >= 2 || (connections >= 1 && hasFlushDraw)) return 'wet';
  return 'dry';
}

/**
 * Get C-bet frequency adjustment based on board texture.
 */
export function textureAdjustment(texture: BoardTexture): number {
  switch (texture) {
    case 'dry': return 0.12;     // +12% C-bet on dry boards
    case 'wet': return -0.12;    // -12% on wet boards
    case 'monotone': return -0.10;
    case 'paired': return 0.05;  // Slight increase on paired
  }
}
