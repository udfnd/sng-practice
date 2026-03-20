/**
 * Seat Resolver — Moving Button Model
 *
 * Resolves buttonSeat, sbSeat, bbSeat each hand.
 * Moving-button: no dead button, BTN/SB/BB always on active players.
 * HU: BTN=SB, non-dealer=BB.
 */

export interface SeatAssignment {
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
}

/**
 * Resolve seats for the next hand using moving-button model.
 *
 * @param activeSeats Sorted seat indices of active (non-eliminated) players
 * @param previousButtonSeat Button seat from previous hand (-1 for first hand)
 * @returns Seat assignment for this hand
 */
export function resolveSeats(
  activeSeats: number[],
  previousButtonSeat: number,
): SeatAssignment {
  if (activeSeats.length < 2) {
    throw new Error(`Need at least 2 active players, got ${activeSeats.length}`);
  }

  if (activeSeats.length === 2) {
    return resolveHU(activeSeats, previousButtonSeat);
  }

  return resolveMultiway(activeSeats, previousButtonSeat);
}

/**
 * Heads-Up resolution: BTN = SB, non-dealer = BB.
 */
function resolveHU(activeSeats: number[], previousButtonSeat: number): SeatAssignment {
  const sorted = [...activeSeats].sort((a, b) => a - b);

  // Advance button clockwise from previous position
  const buttonSeat = nextSeatClockwise(sorted, previousButtonSeat);
  const bbSeat = sorted.find((s) => s !== buttonSeat)!;

  return {
    buttonSeat,
    sbSeat: buttonSeat, // HU: BTN = SB
    bbSeat,
  };
}

/**
 * Multiway (3+ players) resolution.
 * Button advances clockwise. SB = next after button. BB = next after SB.
 */
function resolveMultiway(activeSeats: number[], previousButtonSeat: number): SeatAssignment {
  const sorted = [...activeSeats].sort((a, b) => a - b);

  const buttonSeat = nextSeatClockwise(sorted, previousButtonSeat);
  const sbSeat = nextSeatClockwise(sorted, buttonSeat);
  const bbSeat = nextSeatClockwise(sorted, sbSeat);

  return { buttonSeat, sbSeat, bbSeat };
}

/**
 * Find the next active seat clockwise from a reference seat.
 * "Clockwise" = next higher seat index, wrapping around.
 */
function nextSeatClockwise(sortedSeats: number[], fromSeat: number): number {
  // Find the first seat strictly greater than fromSeat
  for (const seat of sortedSeats) {
    if (seat > fromSeat) return seat;
  }
  // Wrap around to the smallest seat
  return sortedSeats[0]!;
}

/**
 * Resolve 3→2 HU transition.
 * General rule: previous BB's clockwise next surviving player = new BB.
 *
 * @param survivingSeats The 2 remaining seat indices
 * @param previousBBSeat BB seat from the hand where elimination occurred
 * @param allSeatsClockwise All seats in clockwise order (for finding "next")
 */
export function resolveHUTransition(
  survivingSeats: number[],
  previousBBSeat: number,
  allSeatsClockwise: number[],
): SeatAssignment {
  if (survivingSeats.length !== 2) {
    throw new Error(`HU transition requires exactly 2 survivors, got ${survivingSeats.length}`);
  }

  const sorted = [...survivingSeats].sort((a, b) => a - b);

  // Find who should be BB: the next surviving player clockwise from previous BB
  let bbSeat: number;
  const prevBBIndex = allSeatsClockwise.indexOf(previousBBSeat);

  if (prevBBIndex === -1) {
    // Previous BB seat not found (shouldn't happen), fallback
    bbSeat = sorted[1]!;
  } else {
    // Walk clockwise from previous BB position to find next surviving seat
    bbSeat = findNextSurviving(allSeatsClockwise, prevBBIndex, new Set(survivingSeats));
  }

  const btnSeat = sorted.find((s) => s !== bbSeat)!;

  return {
    buttonSeat: btnSeat,
    sbSeat: btnSeat, // HU: BTN = SB
    bbSeat,
  };
}

function findNextSurviving(
  allSeats: number[],
  fromIndex: number,
  survivingSet: Set<number>,
): number {
  const len = allSeats.length;
  for (let i = 1; i < len; i++) {
    const idx = (fromIndex + i) % len;
    if (survivingSet.has(allSeats[idx]!)) {
      return allSeats[idx]!;
    }
  }
  // Fallback: return self if surviving
  if (survivingSet.has(allSeats[fromIndex]!)) {
    return allSeats[fromIndex]!;
  }
  throw new Error('No surviving seat found');
}

/**
 * Get active seats in clockwise order starting from the button.
 * Used for determining action order.
 */
export function getActionOrder(
  activeSeats: number[],
  buttonSeat: number,
): number[] {
  const sorted = [...activeSeats].sort((a, b) => a - b);
  const btnIndex = sorted.indexOf(buttonSeat);
  if (btnIndex === -1) {
    return sorted;
  }
  // Rotate so button is first, then clockwise
  return [...sorted.slice(btnIndex), ...sorted.slice(0, btnIndex)];
}
