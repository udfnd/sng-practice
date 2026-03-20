import type { GameState, Player } from '@/types';
import { makePreflopDecision, type PreflopContext } from './preflop';
import { makePostflopDecision, type PostflopContext } from './postflop';
import { getPositionGroup } from './position';
import { resolveAction, type BettingPlayer, type ActionResult } from '@/engine/betting';
import type { BettingRoundState } from '@/types';
import { PAYOUT_RATIOS } from '@/engine/tournament';
import { calculateSPR } from './spr';

/**
 * Top-level AI action selector.
 * Returns a resolved ActionResult ready for applyAction().
 */
export function selectAIAction(
  player: Player,
  state: GameState,
  preflopAggressor: string | null,
  rng: () => number = Math.random,
): ActionResult {
  const street = state.bettingRound.street;

  const bettingPlayer: BettingPlayer = {
    id: player.id,
    chips: player.chips,
    currentBet: player.currentBet,
    isFolded: player.isFolded,
    isAllIn: player.isAllIn,
  };

  if (street === 'PREFLOP') {
    const ctx = buildPreflopContext(player, state, rng);
    const decision = makePreflopDecision(ctx, rng);
    return translateDecision(decision, bettingPlayer, state.bettingRound);
  } else {
    const ctx = buildPostflopContext(player, state, preflopAggressor);
    const decision = makePostflopDecision(ctx, rng);
    return translateDecision(decision, bettingPlayer, state.bettingRound);
  }
}

/**
 * Build PreflopContext from current GameState for the given player.
 */
export function buildPreflopContext(
  player: Player,
  state: GameState,
  _rng: () => number,
): PreflopContext {
  const bb = state.blindLevel.bb;
  const bettingRound = state.bettingRound;
  const activePlayers = state.players.filter((p) => p.isActive && !p.isFolded);
  const activeSeats = activePlayers.map((p) => p.seatIndex);

  // Position
  const position = getPositionGroup(activeSeats, player.seatIndex, state.buttonSeatIndex);

  // Hole card info
  const holeCards = player.holeCards ?? [
    { encoded: 0, suit: 'spades', rank: 14 },
    { encoded: 1, suit: 'spades', rank: 13 },
  ];
  const rankA = holeCards[0].rank;
  const rankB = holeCards[1].rank;
  const highRank = Math.max(rankA, rankB) as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
  const lowRank = Math.min(rankA, rankB) as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
  const suited = holeCards[0].suit === holeCards[1].suit;

  // Detect situation
  const hasRaiser = bettingRound.lastAggressorId !== null;

  // limperCount: number of players who called without raising
  // A player limped if they called the BB but didn't raise
  // We approximate: actedPlayers who are not the aggressor and have currentBet == bb
  const bbAmount = bb;
  let limperCount = 0;
  if (!hasRaiser) {
    // Count players who have called (currentBet == BB) without raising
    for (const p of activePlayers) {
      if (p.id === player.id) continue;
      if (p.seatIndex === state.sbSeatIndex) continue; // SB is posting blind, not limping
      if (p.seatIndex === state.bbSeatIndex) continue; // BB is posting blind
      if (bettingRound.actedPlayerIds.includes(p.id) && p.currentBet >= bbAmount) {
        limperCount++;
      }
    }
  }

  // isUnopened: no one has raised and no one has limped yet
  const isUnopened = !hasRaiser && limperCount === 0;

  // facingFirstRaise: there is a raise (aggressor exists and it's not the player themselves)
  const facingFirstRaise = hasRaiser && bettingRound.lastAggressorId !== player.id;

  // facingThreeBet: player previously raised, and now someone else has re-raised
  // Detect: player has a currentBet from a preflop raise, and lastAggressor is different
  const playerPreviouslyRaised = bettingRound.actedPlayerIds.includes(player.id)
    && player.currentBet > bb
    && bettingRound.lastAggressorId !== player.id;
  const facingThreeBet = playerPreviouslyRaised && hasRaiser && bettingRound.lastAggressorId !== player.id;

  // isBB: player is in the big blind position
  const isBB = player.seatIndex === state.bbSeatIndex;

  // effectiveStackBB: true effective stack = min(player total stack, max opponent stack) / BB.
  // In HU and short-stack situations, the effective stack is capped by the opponent's stack,
  // because you can only win/lose what the opponent has. This prevents the big stack from
  // staying in normal preflop mode when the opponent is deeply in push/fold territory.
  const totalStack = player.chips + player.currentBet;
  const maxOpponentStack = activePlayers
    .filter((p) => p.id !== player.id)
    .reduce((max, p) => Math.max(max, p.chips + p.currentBet), 0);
  const effectiveStackBB = Math.min(totalStack, maxOpponentStack > 0 ? maxOpponentStack : totalStack) / bb;

  const profile = player.aiProfile!;

  // ICM context: compute stack sizes and payout amounts for ICM calculations
  const allStacks = activePlayers.map((p) => p.chips + p.currentBet);
  const playerStackIndex = activePlayers.findIndex((p) => p.id === player.id);

  // Determine payout amounts from game state or use default top-3 payouts
  // Check if game state has payoutAmounts attached (from TournamentState)
  const stateWithPayouts = state as GameState & { payoutAmounts?: number[] };
  let payoutAmounts: number[] | undefined;
  if (stateWithPayouts.payoutAmounts) {
    payoutAmounts = stateWithPayouts.payoutAmounts;
  } else {
    // Default: top-3 payout structure scaled by total chips in play
    const totalChips = allStacks.reduce((sum, s) => sum + s, 0);
    const ratios = PAYOUT_RATIOS.top3;
    payoutAmounts = ratios.map((r) => Math.round(r * totalChips));
  }

  // Ante detection: check if the blind level includes antes
  const hasAnte = (state.blindLevel.ante ?? 0) > 0;

  return {
    profile,
    highRank,
    lowRank,
    suited,
    position,
    facingBet: bettingRound.currentBet,
    bb,
    currentBet: player.currentBet,
    chips: player.chips,
    isUnopened,
    limperCount,
    facingFirstRaise,
    facingThreeBet,
    isBB,
    activePlayers: activePlayers.length,
    effectiveStackBB,
    allStacks,
    payoutAmounts,
    playerStackIndex: playerStackIndex >= 0 ? playerStackIndex : undefined,
    hasAnte,
  };
}

/**
 * Build PostflopContext from current GameState for the given player.
 */
export function buildPostflopContext(
  player: Player,
  state: GameState,
  preflopAggressor: string | null,
): PostflopContext {
  const bb = state.blindLevel.bb;
  const bettingRound = state.bettingRound;

  // potSize = mainPot + sum(sidePots) + sum of active player currentBets
  const sidePotTotal = state.sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  const currentBetTotal = state.players
    .filter((p) => p.isActive && !p.isFolded)
    .reduce((sum, p) => sum + p.currentBet, 0);
  const potSize = state.mainPot + sidePotTotal + currentBetTotal;

  const isAggressor = player.id === preflopAggressor;
  const facingBet = bettingRound.currentBet > 0 && player.currentBet < bettingRound.currentBet;
  const facingAmount = facingBet ? bettingRound.currentBet - player.currentBet : 0;

  // Street mapping: bettingRound.street is Street which includes PREFLOP
  // PostflopContext only allows FLOP | TURN | RIVER
  const street = (bettingRound.street === 'PREFLOP' ? 'FLOP' : bettingRound.street) as 'FLOP' | 'TURN' | 'RIVER';

  const holeCards = player.holeCards ?? [
    { encoded: 0, suit: 'spades' as const, rank: 14 as const },
    { encoded: 1, suit: 'spades' as const, rank: 13 as const },
  ];

  // Effective stack: min of player's total stack and max opponent stack
  const activePlayers = state.players.filter((p) => p.isActive && !p.isFolded);
  const playerTotalStack = player.chips + player.currentBet;
  const maxOpponentStack = activePlayers
    .filter((p) => p.id !== player.id)
    .reduce((max, p) => Math.max(max, p.chips + p.currentBet), 0);
  const effectiveStack = Math.min(playerTotalStack, maxOpponentStack > 0 ? maxOpponentStack : playerTotalStack);

  // SPR: effective stack / pot
  const spr = calculateSPR(effectiveStack, potSize > 0 ? potSize : 1);

  // Opponents: active non-folded players excluding self
  const opponents = activePlayers.filter((p) => p.id !== player.id).length;

  return {
    profile: player.aiProfile!,
    holeCards: holeCards as [typeof holeCards[0], typeof holeCards[1]],
    communityCards: state.communityCards,
    street,
    isAggressor,
    facingBet,
    facingAmount,
    potSize,
    chips: player.chips,
    bb,
    spr,
    opponents,
  };
}

/**
 * Translate an AI decision (from preflop/postflop) to a resolved ActionResult.
 * Never throws — always falls back to FOLD (or CHECK if legal).
 */
export function translateDecision(
  decision: { action: string; amount: number },
  player: BettingPlayer,
  bettingRound: BettingRoundState,
): ActionResult {
  const facingBet = bettingRound.currentBet > 0 && player.currentBet < bettingRound.currentBet;

  try {
    let actionType = decision.action as import('@/types').ActionType;
    let amount = decision.amount;

    // Mismatch recovery
    if (actionType === 'CHECK' && facingBet) {
      // Cannot check when facing a bet → fold
      return { type: 'FOLD', amount: 0, raiseIncrement: 0, isAllIn: false };
    }

    if (actionType === 'BET' && bettingRound.currentBet > 0) {
      // Cannot BET when there's already a bet → convert to RAISE
      actionType = 'RAISE';
      // amount is the desired total raise-to; use it as raiseTo
    }

    if (actionType === 'RAISE' && bettingRound.currentBet === 0) {
      // Cannot RAISE when no bet exists → convert to BET
      actionType = 'BET';
    }

    return resolveAction(player, actionType, amount, bettingRound);
  } catch (_err) {
    // Error fallback: use FOLD, or CHECK if no bet is facing
    if (!facingBet) {
      return { type: 'CHECK', amount: 0, raiseIncrement: 0, isAllIn: false };
    }
    return { type: 'FOLD', amount: 0, raiseIncrement: 0, isAllIn: false };
  }
}
