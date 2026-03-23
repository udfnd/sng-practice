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
 *
 * Uses a preflop equity-based static ranking derived from all-in equity
 * vs random hand simulations. This replaces the old heuristic scoring
 * (pairStrength/suitedStrength/offsuitStrength) with proven hand ordering.
 */
function buildRangeTable(): HandClass[] {
  // Static 169-hand ranking ordered by preflop equity vs random hand.
  // Source: Standard preflop equity tables (ProPokerTools / PokerStove methodology).
  // Format: [hand_name, combos]
  // Order: strongest first (AA) → weakest last (32o)
  const EQUITY_RANKING: [string, number][] = [
    // --- Premium pairs ---
    ['AA', 6], ['KK', 6], ['QQ', 6], ['JJ', 6],
    // --- Strong broadways + TT ---
    ['AKs', 4], ['TT', 6], ['AQs', 4], ['AKo', 12], ['AJs', 4], ['KQs', 4],
    // --- Medium pairs + broadway ---
    ['99', 6], ['ATs', 4], ['AQo', 12], ['KJs', 4], ['KTs', 4], ['QJs', 4],
    ['AJo', 12], ['A9s', 4], ['88', 6], ['QTs', 4], ['KQo', 12],
    // --- Suited aces + connectors ---
    ['A8s', 4], ['K9s', 4], ['JTs', 4], ['ATo', 12], ['A7s', 4], ['Q9s', 4],
    ['77', 6], ['KJo', 12], ['A5s', 4], ['A6s', 4], ['A4s', 4],
    // --- Middle suited connectors ---
    ['J9s', 4], ['T9s', 4], ['K8s', 4], ['A3s', 4], ['QJo', 12], ['A2s', 4],
    ['A9o', 12], ['K7s', 4], ['Q8s', 4], ['KTo', 12], ['66', 6],
    // --- Suited one-gappers + broadway offsuit ---
    ['J8s', 4], ['T8s', 4], ['A8o', 12], ['K6s', 4], ['Q9o', 12], ['98s', 4],
    ['JTo', 12], ['QTo', 12], ['A7o', 12], ['K5s', 4], ['87s', 4], ['55', 6],
    ['A5o', 12], ['Q7s', 4], ['K4s', 4],
    // --- Low suited connectors + offsuit aces ---
    ['J9o', 12], ['A6o', 12], ['K9o', 12], ['T9o', 12], ['Q6s', 4], ['97s', 4],
    ['K3s', 4], ['A4o', 12], ['J7s', 4], ['76s', 4], ['T7s', 4],
    ['Q8o', 12], ['K2s', 4], ['44', 6],
    // --- Marginal suited + offsuit kings ---
    ['86s', 4], ['A3o', 12], ['Q5s', 4], ['65s', 4], ['J8o', 12], ['98o', 12],
    ['A2o', 12], ['T8o', 12], ['Q4s', 4], ['96s', 4], ['33', 6],
    ['75s', 4], ['87o', 12], ['J6s', 4], ['Q3s', 4], ['54s', 4],
    // --- Weak suited + low offsuit ---
    ['K8o', 12], ['Q7o', 12], ['T6s', 4], ['64s', 4], ['K7o', 12],
    ['J5s', 4], ['Q2s', 4], ['85s', 4], ['22', 6],
    ['97o', 12], ['J4s', 4], ['76o', 12], ['53s', 4],
    // --- Very weak hands ---
    ['J3s', 4], ['43s', 4], ['K6o', 12], ['86o', 12], ['95s', 4], ['74s', 4],
    ['T7o', 12], ['J2s', 4], ['65o', 12], ['Q6o', 12], ['84s', 4],
    ['K5o', 12], ['52s', 4], ['T5s', 4], ['63s', 4],
    // --- Bottom of range ---
    ['Q5o', 12], ['96o', 12], ['54o', 12], ['K4o', 12], ['75o', 12],
    ['T4s', 4], ['42s', 4], ['93s', 4], ['K3o', 12], ['T3s', 4],
    ['Q4o', 12], ['73s', 4], ['85o', 12], ['64o', 12],
    ['82s', 4], ['T2s', 4], ['K2o', 12], ['53o', 12], ['Q3o', 12],
    ['92s', 4], ['62s', 4], ['43o', 12],
    // --- Trash hands ---
    ['J7o', 12], ['Q2o', 12], ['83s', 4], ['J6o', 12], ['94o', 12], ['94s', 4],
    ['72s', 4], ['T6o', 12], ['J5o', 12], ['84o', 12], ['52o', 12],
    ['J4o', 12], ['74o', 12], ['42o', 12], ['95o', 12],
    ['J3o', 12], ['63o', 12], ['93o', 12], ['J2o', 12], ['32s', 4],
    ['T5o', 12], ['82o', 12], ['73o', 12], ['62o', 12],
    ['T4o', 12], ['32o', 12], ['92o', 12], ['83o', 12],
    ['T3o', 12], ['72o', 12], ['T2o', 12],
  ];

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

  let cumCombos = 0;
  return EQUITY_RANKING.map(([name, combos]) => {
    const basePercentile = (cumCombos + combos / 2) / totalCombos;
    cumCombos += combos;

    const percentiles: Record<PositionGroup, number> = {} as any;
    for (const [pos, mult] of Object.entries(positionMultipliers)) {
      percentiles[pos as PositionGroup] = Math.min(1.0, basePercentile / mult);
    }

    return { name, combos, percentiles };
  });
}
