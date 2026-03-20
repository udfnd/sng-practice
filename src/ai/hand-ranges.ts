import type { PositionGroup } from './position';

/**
 * A starting hand class in Hold'em.
 * 169 unique classes: 13 pairs + 78 suited + 78 offsuit
 */
export interface HandClass {
  /** e.g., "AA", "AKs", "AKo" */
  name: string;
  /** Number of actual combos: pair=6, suited=4, offsuit=12 */
  combos: number;
  /** Percentile per position group (0.0 = best hand, 1.0 = worst) */
  percentiles: Record<PositionGroup, number>;
}

/**
 * All 169 starting hand classes sorted by overall strength.
 * Percentiles are combo-weighted: each class occupies combos/1326 of the range.
 */
export const HAND_RANGE_TABLE: HandClass[] = buildRangeTable();

/**
 * Look up the percentile for a specific hand class in a position.
 */
export function getHandPercentile(
  highRank: number,
  lowRank: number,
  suited: boolean,
  position: PositionGroup,
): number {
  const name = handClassName(highRank, lowRank, suited);
  const entry = HAND_RANGE_TABLE.find((h) => h.name === name);
  if (!entry) {
    throw new Error(`Hand class not found: ${name}`);
  }
  return entry.percentiles[position];
}

/**
 * Get the baseline percentile for a hand (average of ring 6 positions, HU excluded).
 * Used for positionAwareness interpolation (Design Doc 6.4.4).
 */
export function getHandBaselinePercentile(
  highRank: number,
  lowRank: number,
  suited: boolean,
): number {
  const name = handClassName(highRank, lowRank, suited);
  const entry = HAND_RANGE_TABLE.find((h) => h.name === name);
  if (!entry) {
    throw new Error(`Hand class not found: ${name}`);
  }
  const ringPositions: PositionGroup[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];
  const sum = ringPositions.reduce((acc, pos) => acc + entry.percentiles[pos], 0);
  return sum / ringPositions.length;
}

/**
 * Get hand class name from ranks.
 * Ranks: 2-14 (14=Ace)
 */
export function handClassName(highRank: number, lowRank: number, suited: boolean): string {
  const rankNames: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
    9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  };
  const high = Math.max(highRank, lowRank);
  const low = Math.min(highRank, lowRank);

  if (high === low) return `${rankNames[high]}${rankNames[low]}`;
  return `${rankNames[high]}${rankNames[low]}${suited ? 's' : 'o'}`;
}

/**
 * Build the 169-hand range table with combo-weighted percentiles.
 * Hands are ranked by a base strength score, then percentiles are assigned
 * per position group with adjustments.
 */
function buildRangeTable(): HandClass[] {
  const hands: { name: string; combos: number; baseStrength: number }[] = [];

  const rankNames: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
    9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
  };

  // Generate all 169 classes
  for (let high = 14; high >= 2; high--) {
    for (let low = high; low >= 2; low--) {
      if (high === low) {
        // Pair
        const strength = pairStrength(high);
        hands.push({ name: `${rankNames[high]}${rankNames[low]}`, combos: 6, baseStrength: strength });
      } else {
        // Suited
        const sStrength = suitedStrength(high, low);
        hands.push({ name: `${rankNames[high]}${rankNames[low]}s`, combos: 4, baseStrength: sStrength });
        // Offsuit
        const oStrength = offsuitStrength(high, low);
        hands.push({ name: `${rankNames[high]}${rankNames[low]}o`, combos: 12, baseStrength: oStrength });
      }
    }
  }

  // Sort by base strength (highest = best)
  hands.sort((a, b) => b.baseStrength - a.baseStrength);

  // Assign combo-weighted percentiles per position
  const totalCombos = 1326;

  // Position adjustments: how much tighter/looser each position plays
  // Lower multiplier = tighter range (hands need to be stronger)
  const positionMultipliers: Record<PositionGroup, number> = {
    EP: 0.85,
    MP: 0.92,
    CO: 1.0,
    BTN: 1.10,
    SB: 0.95,
    BB: 1.0,
    HU: 1.25,
  };

  return hands.map((hand, index) => {
    // Base percentile (combo-weighted cumulative position)
    let cumCombos = 0;
    for (let i = 0; i < index; i++) {
      cumCombos += hands[i]!.combos;
    }
    const basePercentile = (cumCombos + hand.combos / 2) / totalCombos;

    const percentiles: Record<PositionGroup, number> = {} as any;
    for (const [pos, mult] of Object.entries(positionMultipliers)) {
      // Adjusted percentile: divide by multiplier to shift range
      // Higher mult = more hands qualify (wider range)
      percentiles[pos as PositionGroup] = Math.min(1.0, basePercentile / mult);
    }

    return {
      name: hand.name,
      combos: hand.combos,
      percentiles,
    };
  });
}

/** Hand strength scoring for ranking (higher = stronger) */
function pairStrength(rank: number): number {
  // Pairs: AA=200, KK=190, ..., 22=80
  return 80 + (rank - 2) * 10;
}

function suitedStrength(high: number, low: number): number {
  // Gap penalty + high card bonus + suited bonus
  const gap = high - low - 1;
  const highBonus = high * 3;
  const connectedness = gap <= 2 ? (3 - gap) * 5 : 0;
  const suitedBonus = 8;
  return highBonus + connectedness + suitedBonus - gap * 2;
}

function offsuitStrength(high: number, low: number): number {
  const gap = high - low - 1;
  const highBonus = high * 3;
  const connectedness = gap <= 2 ? (3 - gap) * 4 : 0;
  return highBonus + connectedness - gap * 2;
}
