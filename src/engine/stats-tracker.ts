import type { PlayerStats, Street } from '@/types';

/**
 * Parameters for tracking a player action.
 */
export interface TrackActionParams {
  actionType: string;
  street: Street;
  isBlind: boolean;
  isRaise: boolean;
  isFacingFirstRaise: boolean;
  isAggressor?: boolean;
  isCBetOpportunity?: boolean;
}

/**
 * Create a fresh PlayerStats record with all counters at zero.
 */
export function createStats(): PlayerStats {
  return {
    handsEligible: 0,
    vpipCount: 0,
    pfrCount: 0,
    threeBetOpportunities: 0,
    threeBetCount: 0,
    cBetOpportunities: 0,
    cBetCount: 0,
    wentToShowdown: 0,
    wonAtShowdown: 0,
  };
}

/**
 * Increment handsEligible for a dealt hand.
 * Should be called once per hand for each active player (excluding walks).
 */
export function incrementHandsEligible(stats: PlayerStats): void {
  stats.handsEligible++;
}

/**
 * Track a player action and update stats counters.
 *
 * VPIP: voluntary preflop call or raise (not blind post)
 * PFR: preflop raise or bet
 * 3-Bet: re-raise preflop when facing first raise
 * C-Bet: aggressor bets on flop (tracked with opportunity count)
 */
export function trackAction(stats: PlayerStats, params: TrackActionParams): void {
  const { actionType, street, isBlind, isRaise, isFacingFirstRaise, isAggressor, isCBetOpportunity } = params;

  // VPIP: voluntary preflop put-in (call or raise, not blind)
  if (street === 'PREFLOP' && !isBlind) {
    if (actionType === 'CALL' || actionType === 'RAISE' || (actionType === 'BET' && isRaise)) {
      stats.vpipCount++;
    }
  }

  // PFR: preflop raise
  if (street === 'PREFLOP' && !isBlind && isRaise) {
    if (actionType === 'RAISE' || actionType === 'BET') {
      stats.pfrCount++;
    }
  }

  // 3-Bet: facing first raise and re-raises
  if (street === 'PREFLOP' && isFacingFirstRaise) {
    stats.threeBetOpportunities++;
    if (isRaise && (actionType === 'RAISE' || actionType === 'BET')) {
      stats.threeBetCount++;
    }
  }

  // C-Bet: aggressor on flop
  if (street === 'FLOP' && isAggressor && isCBetOpportunity) {
    stats.cBetOpportunities++;
    if (actionType === 'BET' || actionType === 'RAISE') {
      stats.cBetCount++;
    }
  }
}
