import type { SidePot } from '@/types';

/**
 * Minimal player state needed for pot calculations.
 */
export interface PotPlayer {
  id: string;
  chips: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
}

/**
 * Result of collectBets(): the new pot state after a street ends.
 */
export interface CollectResult {
  mainPot: number;
  sidePots: SidePot[];
}

/**
 * Result of distributing a pot to winners.
 */
export interface PotPayout {
  playerId: string;
  amount: number;
}

/**
 * Assert the 3-bucket chip conservation invariant.
 * sum(player.chips) + sum(player.currentBet) + mainPot + sum(sidePots) === totalChips
 */
// @MX:ANCHOR fan_in=3 | 3-bucket chip conservation check — stacks+bets+pots===totalChips
export function assertChipInvariant(
  players: PotPlayer[],
  mainPot: number,
  sidePots: SidePot[],
  totalChips: number,
): void {
  const stackSum = players.reduce((sum, p) => sum + p.chips, 0);
  const betSum = players.reduce((sum, p) => sum + p.currentBet, 0);
  const potSum = mainPot + sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  const actual = stackSum + betSum + potSum;

  if (actual !== totalChips) {
    throw new Error(
      `Chip invariant violated: stacks(${stackSum}) + bets(${betSum}) + pots(${potSum}) = ${actual}, expected ${totalChips}`,
    );
  }
}

/**
 * Collect all player bets into pots at the end of a street.
 * Creates side pots when players are all-in for different amounts.
 * Resets all player.currentBet to 0.
 *
 * @param players Mutable player array — currentBet will be zeroed
 * @param existingMainPot Current main pot amount (from prior streets/BBA)
 * @param existingSidePots Current side pots
 * @returns Updated pot state
 */
// @MX:ANCHOR fan_in=3 | Street-end bet collection with side pot creation — called by state machine transitions
export function collectBets(
  players: PotPlayer[],
  existingMainPot: number,
  existingSidePots: SidePot[],
): CollectResult {
  // Get all-in amounts (sorted ascending) to determine pot boundaries
  const allInAmounts = players
    .filter((p) => p.isAllIn && p.currentBet > 0)
    .map((p) => p.currentBet)
    .sort((a, b) => a - b);

  // Unique boundaries (deduplicate)
  const boundaries = [...new Set(allInAmounts)];

  // Players with active bets (non-zero currentBet, including folded who bet before folding)
  const activeBettors = players.filter((p) => p.currentBet > 0);

  if (activeBettors.length === 0) {
    return { mainPot: existingMainPot, sidePots: [...existingSidePots] };
  }

  let mainPot = existingMainPot;
  const sidePots = [...existingSidePots];

  if (boundaries.length === 0) {
    // No all-ins: everything goes to main pot
    const totalBets = activeBettors.reduce((sum, p) => sum + p.currentBet, 0);
    mainPot += totalBets;
  } else {
    // Process each boundary level to create pots
    let prevLevel = 0;

    for (const boundary of boundaries) {
      const slice = boundary - prevLevel;
      if (slice <= 0) continue;

      // Who contributes to this level?
      const eligible: string[] = [];
      let potAmount = 0;

      for (const p of activeBettors) {
        const contribution = Math.min(p.currentBet, boundary) - Math.min(p.currentBet, prevLevel);
        if (contribution > 0) {
          potAmount += contribution;
          if (!p.isFolded) {
            eligible.push(p.id);
          }
        }
      }

      if (potAmount > 0) {
        if (prevLevel === 0) {
          // First level goes to main pot
          mainPot += potAmount;
          // Update main pot eligibility: merge with existing eligible or set new
        } else {
          sidePots.push({ amount: potAmount, eligiblePlayerIds: eligible });
        }
      }

      prevLevel = boundary;
    }

    // Remaining bets above highest all-in boundary
    let remainingAmount = 0;
    const remainingEligible: string[] = [];

    for (const p of activeBettors) {
      const remaining = p.currentBet - Math.min(p.currentBet, prevLevel);
      if (remaining > 0) {
        remainingAmount += remaining;
        if (!p.isFolded) {
          remainingEligible.push(p.id);
        }
      }
    }

    if (remainingAmount > 0) {
      if (boundaries.length === 0 || (boundaries.length === 1 && prevLevel === boundaries[0])) {
        sidePots.push({ amount: remainingAmount, eligiblePlayerIds: remainingEligible });
      } else {
        sidePots.push({ amount: remainingAmount, eligiblePlayerIds: remainingEligible });
      }
    }
  }

  // Zero all bets
  for (const p of players) {
    p.currentBet = 0;
  }

  return { mainPot, sidePots };
}

/**
 * Calculate the uncalled bet amount.
 * When the last bet/raise has no caller, the excess is returned.
 *
 * @param lastBettorBet The currentBet of the last bettor/raiser
 * @param secondHighestBet The highest currentBet among other active (non-folded) players
 * @returns Amount to return (0 if fully called)
 */
export function calcUncalledBet(lastBettorBet: number, secondHighestBet: number): number {
  if (lastBettorBet <= secondHighestBet) return 0;
  return lastBettorBet - secondHighestBet;
}

/**
 * Distribute a single pot among winners.
 * Handles split pots and odd chip (to button-clockwise nearest winner).
 *
 * @param potAmount Total pot to distribute
 * @param winnerIds Player IDs of the winners (may be tied)
 * @param buttonSeat Button seat index (for odd chip rule)
 * @param seatOrder All seat indices in clockwise order from button
 * @returns Array of payouts
 */
export function distributePot(
  potAmount: number,
  winnerIds: string[],
  winnerSeatMap: Map<string, number>,
  buttonSeat: number,
  activeSeatOrder: number[],
): PotPayout[] {
  if (winnerIds.length === 0) {
    throw new Error('Cannot distribute pot: no winners');
  }

  if (winnerIds.length === 1) {
    return [{ playerId: winnerIds[0]!, amount: potAmount }];
  }

  // Split pot evenly
  const share = Math.floor(potAmount / winnerIds.length);
  const remainder = potAmount - share * winnerIds.length;

  const payouts: PotPayout[] = winnerIds.map((id) => ({
    playerId: id,
    amount: share,
  }));

  // Odd chip goes to button-clockwise nearest winner
  if (remainder > 0) {
    const sortedWinners = [...winnerIds].sort((a, b) => {
      const seatA = winnerSeatMap.get(a) ?? 0;
      const seatB = winnerSeatMap.get(b) ?? 0;
      return clockwiseDistance(buttonSeat, seatA, activeSeatOrder) -
        clockwiseDistance(buttonSeat, seatB, activeSeatOrder);
    });

    const oddChipWinner = payouts.find((p) => p.playerId === sortedWinners[0]);
    if (oddChipWinner) {
      oddChipWinner.amount += remainder;
    }
  }

  return payouts;
}

/**
 * Calculate clockwise distance from a reference seat to a target seat.
 */
function clockwiseDistance(from: number, to: number, seatOrder: number[]): number {
  const fromIdx = seatOrder.indexOf(from);
  const toIdx = seatOrder.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return Infinity;

  const len = seatOrder.length;
  return (toIdx - fromIdx + len) % len;
}

/**
 * Add BBA (Big Blind Ante) as dead money directly to main pot.
 * BBA does NOT go to player.currentBet — it goes straight to mainPot.
 */
export function addBbaToMainPot(mainPot: number, bbaAmount: number): number {
  return mainPot + bbaAmount;
}
