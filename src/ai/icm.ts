/**
 * ICM (Independent Chip Model) Calculation Engine.
 * Implements Malmuth-Harville algorithm for tournament equity calculation.
 *
 * SPEC-AI-008: ICM Calculation Engine & Bubble Factor
 */

/**
 * Malmuth-Harville ICM equity calculation.
 * @param stacks Active player stack sizes (must be > 0)
 * @param payouts Prize amounts (descending: 1st, 2nd, 3rd...)
 * @returns Array of equity values for each player (sum = total prize pool)
 */
export function calculateICM(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const equity = new Array<number>(n).fill(0);

  if (n === 0 || payouts.length === 0) {
    return equity;
  }

  // Recursive helper: distribute prize positions among remaining players
  function distribute(
    remainingStacks: number[],
    position: number,
    probability: number,
    result: number[],
  ): void {
    if (position >= payouts.length) return;

    const totalRemaining = remainingStacks.reduce((sum, s) => sum + s, 0);
    if (totalRemaining === 0) return;

    for (let i = 0; i < n; i++) {
      if (remainingStacks[i] <= 0) continue;

      const prob_i_wins = remainingStacks[i] / totalRemaining;
      const combinedProb = probability * prob_i_wins;

      // Player i finishes at 'position'
      result[i] += combinedProb * payouts[position];

      // Recurse: remove player i, remaining players compete for next position
      const newStacks = [...remainingStacks];
      newStacks[i] = 0;
      distribute(newStacks, position + 1, combinedProb, result);
    }
  }

  distribute(stacks, 0, 1.0, equity);
  return equity;
}

/**
 * Compute bubble factor: how much riskier losing chips is vs gaining them.
 * bubbleFactor >= 1.0 always. = ~1.0 in HU or early tournament.
 *
 * @param stacks All player stack sizes
 * @param payouts Prize amounts (descending)
 * @param playerIndex Index of the player we compute BF for
 * @param opponentIndex Index of the opponent in the pot
 * @param effectiveStack Chips at risk in this confrontation
 */
export function computeBubbleFactor(
  stacks: number[],
  payouts: number[],
  playerIndex: number,
  opponentIndex: number,
  effectiveStack: number,
): number {
  const currentEquity = calculateICM(stacks, payouts)[playerIndex];

  // Scenario: player LOSES effectiveStack to opponent
  const stacksAfterLoss = [...stacks];
  stacksAfterLoss[playerIndex] -= effectiveStack;
  stacksAfterLoss[opponentIndex] += effectiveStack;

  let equityAfterLoss: number;
  if (stacksAfterLoss[playerIndex] <= 0) {
    // Player is busted
    equityAfterLoss = 0;
    stacksAfterLoss[playerIndex] = 0;
  } else {
    equityAfterLoss = calculateICM(stacksAfterLoss, payouts)[playerIndex];
  }

  // Scenario: player WINS effectiveStack from opponent
  const stacksAfterWin = [...stacks];
  stacksAfterWin[playerIndex] += effectiveStack;
  stacksAfterWin[opponentIndex] -= effectiveStack;

  let equityAfterWin: number;
  if (stacksAfterWin[opponentIndex] <= 0) {
    // Opponent is busted - need to recalculate with updated stacks
    stacksAfterWin[opponentIndex] = 0;
    // Filter out zero stacks, recalculate ICM, then map back to playerIndex
    const nonZeroIndices = stacksAfterWin
      .map((s, i) => (s > 0 ? i : -1))
      .filter((i) => i >= 0);
    const nonZeroStacks = nonZeroIndices.map((i) => stacksAfterWin[i]);
    const subEquities = calculateICM(nonZeroStacks, payouts);
    const mappedPlayerIndex = nonZeroIndices.indexOf(playerIndex);
    equityAfterWin = mappedPlayerIndex >= 0 ? subEquities[mappedPlayerIndex] : 0;
  } else {
    equityAfterWin = calculateICM(stacksAfterWin, payouts)[playerIndex];
  }

  const riskEquity = currentEquity - equityAfterLoss;
  const rewardEquity = equityAfterWin - currentEquity;

  // Guard against degenerate cases
  if (rewardEquity <= 0) return 3.0; // cap at 3.0
  return Math.max(1.0, riskEquity / rewardEquity);
}

/**
 * Adjust a push/fold threshold using ICM bubble factor and awareness knobs.
 *
 * The adjustment scales the threshold down (tighter play) when:
 * - bubbleFactor is high (more pressure)
 * - icmAwareness is high (player cares about ICM)
 * - bubbleTightness is high (player adjusts heavily to bubble)
 *
 * Formula:
 *   effectiveBF = 1 + (bubbleFactor - 1) * bubbleTightness
 *   icmMultiplier = 1 / effectiveBF
 *   adjusted = baseThreshold * (1 - icmAwareness) + baseThreshold * icmMultiplier * icmAwareness
 *            = baseThreshold * (1 - icmAwareness + icmAwareness / effectiveBF)
 *
 * @param baseThreshold The raw push/fold threshold (0-1)
 * @param bubbleFactor Computed bubble factor (>= 1.0)
 * @param icmAwareness How much the player adjusts for ICM (0-1)
 * @param bubbleTightness How strongly the player tightens on bubble (0-1)
 */
export function icmAdjustedThreshold(
  baseThreshold: number,
  bubbleFactor: number,
  icmAwareness: number,
  bubbleTightness: number,
): number {
  if (icmAwareness <= 0) return baseThreshold;
  if (bubbleFactor <= 1.0) return baseThreshold;

  // Apply bubbleTightness to scale the bubble factor's effect
  const effectiveBF = 1 + (bubbleFactor - 1) * bubbleTightness;
  const icmMultiplier = 1 / effectiveBF;

  // Interpolate between base (no ICM) and ICM-adjusted
  const adjusted = baseThreshold * (1 - icmAwareness + icmAwareness * icmMultiplier);

  // Clamp to valid range
  return Math.max(0, Math.min(1, adjusted));
}
