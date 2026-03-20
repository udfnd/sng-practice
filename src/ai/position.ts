/**
 * Position groups for range table lookup.
 * 7 groups: EP, MP, CO, BTN, SB, BB, HU
 */
export type PositionGroup = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB' | 'HU';

/**
 * Position mapping table: playerCount → relativePos → PositionGroup
 * relativePos 0 = BTN, 1 = SB, 2 = BB, 3+ = EP→CO
 */
const POSITION_MAP: Record<number, PositionGroup[]> = {
  // 8 players: BTN, SB, BB, EP1, EP2, MP, MP, CO
  8: ['BTN', 'SB', 'BB', 'EP', 'EP', 'MP', 'MP', 'CO'],
  // 7 players: BTN, SB, BB, EP, MP, MP, CO
  7: ['BTN', 'SB', 'BB', 'EP', 'MP', 'MP', 'CO'],
  // 6 players: BTN, SB, BB, MP, CO, CO
  6: ['BTN', 'SB', 'BB', 'MP', 'CO', 'CO'],
  // 5 players: BTN, SB, BB, CO, CO
  5: ['BTN', 'SB', 'BB', 'CO', 'CO'],
  // 4 players: BTN, SB, BB, CO
  4: ['BTN', 'SB', 'BB', 'CO'],
  // 3 players: BTN, SB, BB
  3: ['BTN', 'SB', 'BB'],
  // 2 players (HU): BTN(=SB), BB
  2: ['BTN', 'BB'],
};

/**
 * Get position group for a player based on active seat order.
 *
 * @param activeSeats Active seat indices sorted clockwise from dealer
 * @param playerSeat The player's seat index
 * @param buttonSeat The dealer/button seat index
 * @returns Position group for range table lookup
 */
// @MX:ANCHOR fan_in=3 | Position lookup from active seats — drives range table selection for AI
export function getPositionGroup(
  activeSeats: number[],
  playerSeat: number,
  buttonSeat: number,
): PositionGroup {
  const playerCount = activeSeats.length;

  if (playerCount === 2) return playerSeat === buttonSeat ? 'BTN' : 'BB';

  // Build clockwise order from button
  const sorted = [...activeSeats].sort((a, b) => a - b);
  const btnIdx = sorted.indexOf(buttonSeat);
  const ordered = [...sorted.slice(btnIdx), ...sorted.slice(0, btnIdx)];

  const relPos = ordered.indexOf(playerSeat);
  if (relPos === -1) {
    throw new Error(`Player seat ${playerSeat} not found in active seats`);
  }

  const map = POSITION_MAP[playerCount];
  if (!map || relPos >= map.length) {
    throw new Error(`No position mapping for ${playerCount} players, relPos ${relPos}`);
  }

  return map[relPos]!;
}

/**
 * Check if the current situation is heads-up.
 * HU uses a separate range table (wider ranges).
 */
export function isHeadsUp(activePlayerCount: number): boolean {
  return activePlayerCount === 2;
}
