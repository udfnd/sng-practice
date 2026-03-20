import type {
  TournamentState,
  GameEvent,
  Standing,
  Street,
  ActionType,
} from '@/types';
import {
  transitionToResolveSeats,
  transitionToPostBlinds,
  transitionToDealing,
  transitionToPreflop,
  transitionToNextStreet,
  transitionToShowdown,
  transitionToHandComplete,
  transitionToWaiting,
  handleFoldWin,
  isFoldWin,
} from './state-machine';
import {
  resolveAction,
  applyAction,
  isBettingComplete,
  isAllInRunout,
  type BettingPlayer,
} from './betting';
import {
  distributePot,
  assertChipInvariant,
  calcUncalledBet,
  type PotPlayer,
} from './pot';
import { getShowdownOrder, determineWinners } from './showdown';
import {
  checkBlindLevelUp,
  eliminatePlayer,
  eliminateSimultaneous,
  isTournamentComplete,
  finalizeTournament,
} from './tournament';
import {
  resetSequence,
  handStartEvent,
  postBlindEvent,
  dealHoleEvent,
  dealCommunityEvent,
  playerActionEvent,
  uncalledReturnEvent,
  showdownEvent,
  awardPotEvent,
  playerEliminatedEvent,
  blindLevelUpEvent,
  tournamentEndEvent,
} from './events';
import { getActionOrder, getNextPlayer, getValidActions, type ValidActionsResult } from './action-order';
import { selectAIAction } from '@/ai/action-selector';
import { trackAction, incrementHandsEligible } from './stats-tracker';
import { seedFromString, nextFloat, type PrngState } from './prng';

/**
 * Action response returned by ActionProvider.
 */
export interface ActionResponse {
  type: ActionType;
  amount: number;
}

/**
 * Callback invoked when it's a player's turn to act.
 * For human players, this yields to the UI.
 * For AI players, this returns immediately with the computed action.
 *
 * @param playerId The player who needs to act
 * @param validActions The set of valid actions available
 * @param bettingPlayer Current state of the player (chips, currentBet, etc.)
 * @returns The player's chosen action
 */
export type ActionProvider = (
  playerId: string,
  validActions: ValidActionsResult,
  bettingPlayer: BettingPlayer,
) => Promise<ActionResponse>;

/**
 * Run a single hand from the current tournament state.
 * Mutates tournament.gameState in place.
 *
 * @param tournament The tournament state
 * @param getAction The action provider callback
 * @returns Array of GameEvents emitted during this hand
 */
// @MX:WARN @MX:REASON="8-phase hand lifecycle: seat resolve, blinds, deal, preflop, flop, turn, river, showdown" | Core hand orchestration with full phase management
export async function runHand(
  tournament: TournamentState,
  getAction: ActionProvider,
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];
  const { gameState, totalChips } = tournament;

  // Reset per-hand event sequence
  resetSequence();

  // Per-hand state
  let preflopAggressor: string | null = null;
  let handPrng: PrngState | null = null;

  // Phase 1: WAITING → RESOLVE_SEATS
  transitionToResolveSeats(gameState);

  // Phase 2: RESOLVE_SEATS → POSTING_BLINDS
  transitionToPostBlinds(gameState);

  // Use chips before blinds for stacks in HAND_START
  const stacksAtStart = gameState.players
    .filter((p) => p.isActive)
    .map((p) => ({ playerId: p.id, chips: p.chips + p.currentBet }));

  events.push(
    handStartEvent(
      gameState.handNumber,
      gameState.seed || 'pending',
      gameState.blindLevel,
      gameState.buttonSeatIndex,
      gameState.sbSeatIndex,
      gameState.bbSeatIndex,
      stacksAtStart,
    ),
  );

  // Emit POST_BLIND events
  const sbPlayer = gameState.players.find((p) => p.seatIndex === gameState.sbSeatIndex);
  if (sbPlayer) {
    const sbAmount = gameState.blindLevel.sb;
    events.push(postBlindEvent(gameState.handNumber, sbPlayer.id, Math.min(sbAmount, sbPlayer.currentBet), 'SB'));
  }

  const bbPlayer = gameState.players.find((p) => p.seatIndex === gameState.bbSeatIndex);
  if (bbPlayer) {
    events.push(postBlindEvent(gameState.handNumber, bbPlayer.id, gameState.blindLevel.bb, 'BB'));
    if (gameState.blindLevel.ante > 0) {
      events.push(postBlindEvent(gameState.handNumber, bbPlayer.id, gameState.blindLevel.ante, 'BBA'));
    }
  }

  // Phase 3: POSTING_BLINDS → DEALING
  const deck = await transitionToDealing(gameState, tournament.config.initialSeed || undefined);

  // Initialize per-hand PRNG from the hand seed
  try {
    handPrng = await seedFromString(gameState.seed || String(gameState.handNumber));
  } catch {
    handPrng = null;
  }

  // Update HAND_START event seed now that we have it
  const handStartEvt = events.find((e) => e.type === 'HAND_START');
  if (handStartEvt) {
    (handStartEvt.payload as any).seed = gameState.seed;
  }

  // Emit DEAL_HOLE events and track handsEligible
  for (const p of gameState.players.filter((p) => p.isActive)) {
    if (p.holeCards) {
      events.push(dealHoleEvent(gameState.handNumber, p.id, p.holeCards));
      // Track hands eligible for each dealt player
      incrementHandsEligible(p.stats);
    }
  }

  // Phase 4: DEALING → PREFLOP
  transitionToPreflop(gameState);

  // Run preflop betting round
  await runBettingRound(tournament, getAction, events, preflopAggressor, handPrng, (id) => { preflopAggressor = id; });

  // Check for fold-win
  if (isFoldWin(gameState)) {
    const totalPot = gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);
    const winnerId = handleFoldWin(gameState);
    assertChipInvariant(
      toPotPlayers(gameState.players),
      gameState.mainPot,
      gameState.sidePots,
      totalChips,
    );
    events.push(
      awardPotEvent(gameState.handNumber, 0, [{ playerId: winnerId, amount: totalPot }]),
    );
    transitionToHandComplete(gameState);
    return events;
  }

  // Run FLOP, TURN, RIVER streets
  const streets: Street[] = ['FLOP', 'TURN', 'RIVER'];
  for (const street of streets) {
    // Check for all-in runout (skip betting, just deal)
    const bettingPlayers = toBettingPlayers(gameState.players);
    const runout = isAllInRunout(bettingPlayers);

    // Transition to next street (deals community cards)
    transitionToNextStreet(gameState, deck);
    assertChipInvariant(
      toPotPlayers(gameState.players),
      gameState.mainPot,
      gameState.sidePots,
      totalChips,
    );

    // Emit community card event
    const newCards = gameState.communityCards.slice(
      street === 'FLOP' ? 0 : street === 'TURN' ? 3 : 4,
    );
    events.push(dealCommunityEvent(gameState.handNumber, newCards, street as 'FLOP' | 'TURN' | 'RIVER'));

    if (!runout) {
      // Run betting round for this street
      await runBettingRound(tournament, getAction, events, preflopAggressor, handPrng, null);

      // Check fold-win after each street
      if (isFoldWin(gameState)) {
        const totalPot = gameState.mainPot + gameState.sidePots.reduce((s, sp) => s + sp.amount, 0);
        const winnerId = handleFoldWin(gameState);
        assertChipInvariant(
          toPotPlayers(gameState.players),
          gameState.mainPot,
          gameState.sidePots,
          totalChips,
        );
        events.push(
          awardPotEvent(gameState.handNumber, 0, [{ playerId: winnerId, amount: totalPot }]),
        );
        transitionToHandComplete(gameState);
        return events;
      }
    }

    if (street === 'RIVER') break;
  }

  // Phase: SHOWDOWN
  transitionToShowdown(gameState);
  assertChipInvariant(
    toPotPlayers(gameState.players),
    gameState.mainPot,
    gameState.sidePots,
    totalChips,
  );

  // Run showdown
  await runShowdown(tournament, events);

  // Phase: HAND_COMPLETE
  transitionToHandComplete(gameState);

  return events;
}

/**
 * Run a betting round for the current street.
 * Handles action order, player actions, and betting completion.
 */
async function runBettingRound(
  tournament: TournamentState,
  getAction: ActionProvider,
  events: GameEvent[],
  preflopAggressor: string | null,
  handPrng: PrngState | null,
  setPreflopAggressor: ((id: string) => void) | null,
): Promise<void> {
  const { gameState } = tournament;

  // Build action order for this street
  const actionOrder = getActionOrder(gameState);

  // Map to BettingPlayers
  let bettingPlayers = toBettingPlayers(gameState.players.filter((p) => p.isActive));

  // Check if already done (e.g., all-in runout)
  if (isAllInRunout(bettingPlayers)) return;
  if (isBettingComplete(bettingPlayers, gameState.bettingRound)) return;

  // Find first player to act
  let currentPlayerId: string | null = getNextPlayer(
    actionOrder,
    bettingPlayers,
    gameState.bettingRound,
    null,
  );

  const maxIterations = 100;
  let iterations = 0;

  while (currentPlayerId !== null) {
    if (iterations++ >= maxIterations) break;

    // Find the actual player
    const player = gameState.players.find((p) => p.id === currentPlayerId);
    if (!player || !player.isActive) break;

    // Build BettingPlayer from current player state
    const bettingPlayer: BettingPlayer = {
      id: player.id,
      chips: player.chips,
      currentBet: player.currentBet,
      isFolded: player.isFolded,
      isAllIn: player.isAllIn,
    };

    // Skip if already folded or all-in
    if (bettingPlayer.isFolded || bettingPlayer.isAllIn) {
      bettingPlayers = toBettingPlayers(gameState.players.filter((p) => p.isActive));
      currentPlayerId = getNextPlayer(
        actionOrder,
        bettingPlayers,
        gameState.bettingRound,
        currentPlayerId,
      );
      continue;
    }

    // Get valid actions
    const validActions = getValidActions(bettingPlayer, gameState.bettingRound, gameState.blindLevel.bb);

    let actionResult;
    if (!player.isHuman && player.aiProfile) {
      // AI player: use selectAIAction with per-hand PRNG.
      // handPrng must be initialized before any AI action is taken.
      if (!handPrng) throw new Error('handPrng must be initialized before AI actions');
      const rng = () => nextFloat(handPrng);
      actionResult = selectAIAction(player, gameState, preflopAggressor, rng);
    } else {
      // Human player: delegate to ActionProvider
      const response = await getAction(currentPlayerId, validActions, bettingPlayer);
      actionResult = resolveAction(bettingPlayer, response.type, response.amount, gameState.bettingRound);
    }

    applyAction(bettingPlayer, actionResult, gameState.bettingRound);

    // Track preflop aggressor
    const street = gameState.bettingRound.street;
    if (street === 'PREFLOP' && setPreflopAggressor !== null) {
      if (actionResult.type === 'RAISE' || actionResult.type === 'BET') {
        setPreflopAggressor(player.id);
      }
    }

    // Track stats after PLAYER_ACTION
    const isPreflop = street === 'PREFLOP';
    const isBlind = false; // blind posting is separate, not tracked here
    const isRaise = actionResult.type === 'RAISE' || actionResult.type === 'BET';
    const isFacingFirstRaise = isPreflop
      && gameState.bettingRound.lastAggressorId !== null
      && gameState.bettingRound.lastAggressorId !== player.id;

    const isAggressor = player.id === preflopAggressor;
    // C-bet opportunity: aggressor first action on flop, no prior bet
    const isCBetOpportunity = street === 'FLOP'
      && isAggressor
      && gameState.bettingRound.currentBet === 0;

    trackAction(player.stats, {
      actionType: actionResult.type,
      street,
      isBlind,
      isRaise,
      isFacingFirstRaise,
      isAggressor,
      isCBetOpportunity,
    });

    // Sync back to game state player
    player.chips = bettingPlayer.chips;
    player.currentBet = bettingPlayer.currentBet;
    player.isFolded = bettingPlayer.isFolded;
    player.isAllIn = bettingPlayer.isAllIn;

    // Emit PLAYER_ACTION event
    events.push(
      playerActionEvent(
        gameState.handNumber,
        player.id,
        actionResult.type,
        actionResult.amount,
        actionResult.isAllIn,
      ),
    );

    // Re-build betting players with updated state
    bettingPlayers = toBettingPlayers(gameState.players.filter((p) => p.isActive));

    // Check fold-win
    const nonFolded = bettingPlayers.filter((p) => !p.isFolded);
    if (nonFolded.length <= 1) break;

    // Check if betting is complete
    if (isBettingComplete(bettingPlayers, gameState.bettingRound)) break;

    // Check all-in runout
    if (isAllInRunout(bettingPlayers)) break;

    // Get next player
    currentPlayerId = getNextPlayer(
      actionOrder,
      bettingPlayers,
      gameState.bettingRound,
      currentPlayerId,
    );
  }

  // Handle uncalled bet return (if last aggressor's bet was not matched)
  handleUncalledBet(tournament, events);
}

/**
 * Return uncalled bet to the last aggressor if their bet exceeds the second-highest bet.
 */
function handleUncalledBet(tournament: TournamentState, events: GameEvent[]): void {
  const { gameState } = tournament;
  const activePlayers = gameState.players.filter((p) => p.isActive && !p.isFolded);

  if (activePlayers.length < 1) return;

  const sortedBets = activePlayers
    .map((p) => ({ id: p.id, bet: p.currentBet }))
    .sort((a, b) => b.bet - a.bet);

  if (sortedBets.length < 1) return;

  const highestBet = sortedBets[0]!.bet;
  const secondBet = sortedBets[1]?.bet ?? 0;
  const uncalledAmount = calcUncalledBet(highestBet, secondBet);

  if (uncalledAmount > 0) {
    const playerId = sortedBets[0]!.id;
    const player = gameState.players.find((p) => p.id === playerId);
    if (player) {
      player.currentBet -= uncalledAmount;
      player.chips += uncalledAmount;
      events.push(uncalledReturnEvent(gameState.handNumber, playerId, uncalledAmount));
    }
  }
}

/**
 * Run the showdown phase: reveal cards, determine winners, distribute pots.
 */
async function runShowdown(
  tournament: TournamentState,
  events: GameEvent[],
): Promise<void> {
  const { gameState, totalChips } = tournament;

  // Build action order for showdown reveal order
  const actionOrder = getActionOrder(gameState);

  // Get showdown order
  const reveals = getShowdownOrder(
    gameState.players,
    gameState.communityCards,
    gameState.bettingRound.lastAggressorId,
    actionOrder,
  );

  // Emit SHOWDOWN event
  events.push(
    showdownEvent(
      gameState.handNumber,
      reveals.map((r) => ({
        playerId: r.playerId,
        cards: r.cards,
        handRank: r.hand.rank,
      })),
    ),
  );

  // Determine and distribute pots
  const winnerSeatMap = new Map(
    gameState.players.map((p) => [p.id, p.seatIndex]),
  );
  const activeSeatOrder = gameState.players
    .filter((p) => p.isActive)
    .map((p) => p.seatIndex)
    .sort((a, b) => a - b);

  let potIndex = 0;

  // Main pot: all non-folded eligible players
  if (gameState.mainPot > 0) {
    const mainPotEligible = reveals.filter((r) => {
      const player = gameState.players.find((p) => p.id === r.playerId);
      return player && !player.isFolded;
    });

    const mainWinners = determineWinners(mainPotEligible);
    const payouts = distributePot(
      gameState.mainPot,
      mainWinners,
      winnerSeatMap,
      gameState.buttonSeatIndex,
      activeSeatOrder,
    );

    for (const payout of payouts) {
      const player = gameState.players.find((p) => p.id === payout.playerId);
      if (player) player.chips += payout.amount;
    }
    gameState.mainPot = 0;

    events.push(awardPotEvent(gameState.handNumber, potIndex++, payouts));
    assertChipInvariant(toPotPlayers(gameState.players), gameState.mainPot, gameState.sidePots, totalChips);
  }

  // Side pots
  for (const sidePot of gameState.sidePots) {
    let sidePotEligible = reveals.filter((r) =>
      sidePot.eligiblePlayerIds.includes(r.playerId),
    );

    // If no eligible players remain at showdown (all folded), fall back to all
    // non-folded players to preserve chip conservation
    if (sidePotEligible.length === 0) {
      sidePotEligible = reveals;
    }
    if (sidePotEligible.length === 0) continue;

    const sideWinners = determineWinners(sidePotEligible);
    const payouts = distributePot(
      sidePot.amount,
      sideWinners,
      winnerSeatMap,
      gameState.buttonSeatIndex,
      activeSeatOrder,
    );

    for (const payout of payouts) {
      const player = gameState.players.find((p) => p.id === payout.playerId);
      if (player) player.chips += payout.amount;
    }

    events.push(awardPotEvent(gameState.handNumber, potIndex++, payouts));
  }

  gameState.sidePots = [];
  assertChipInvariant(toPotPlayers(gameState.players), gameState.mainPot, gameState.sidePots, totalChips);
}

/**
 * Run a full tournament until completion.
 *
 * @param tournament The tournament state
 * @param getAction The action provider callback
 * @param onEvent Called for each GameEvent emitted
 * @returns Final standings
 */
// @MX:NOTE | Tournament loop: runHand → eliminate → checkBlindLevelUp → repeat until 1 player remains
export async function runTournament(
  tournament: TournamentState,
  getAction: ActionProvider,
  onEvent: (event: GameEvent) => void,
): Promise<Standing[]> {
  const maxHands = 500; // Safety limit (typical SNG: 60-120 hands)
  let handsPlayed = 0;

  while (!isTournamentComplete(tournament) && handsPlayed < maxHands) {
    handsPlayed++;

    // Track starting chips for elimination calculation
    const startingChips = new Map(
      tournament.gameState.players
        .filter((p) => p.isActive)
        .map((p) => [p.id, p.chips]),
    );

    // Run a single hand
    const handEvents = await runHand(tournament, getAction);

    // Emit all events
    for (const event of handEvents) {
      onEvent(event);
    }

    // Process eliminations (players with 0 chips)
    const handNumber = tournament.gameState.handNumber;
    const eliminatedPlayers = tournament.gameState.players.filter(
      (p) => p.isActive && p.chips === 0,
    );

    if (eliminatedPlayers.length === 1) {
      const eliminated = eliminatedPlayers[0]!;
      const chips = startingChips.get(eliminated.id) ?? 0;
      const elimination = eliminatePlayer(tournament, eliminated.id, chips);

      const elimEvent = playerEliminatedEvent(
        handNumber,
        elimination.playerId,
        elimination.finishPosition,
        elimination.payout,
      );
      onEvent(elimEvent);
    } else if (eliminatedPlayers.length > 1) {
      const playersData = eliminatedPlayers.map((p) => ({
        playerId: p.id,
        chipsAtHandStart: startingChips.get(p.id) ?? 0,
      }));
      const eliminations = eliminateSimultaneous(tournament, playersData);

      for (const elimination of eliminations) {
        const elimEvent = playerEliminatedEvent(
          handNumber,
          elimination.playerId,
          elimination.finishPosition,
          elimination.payout,
        );
        onEvent(elimEvent);
      }
    }

    // Transition to WAITING for next hand
    transitionToWaiting(tournament.gameState);

    // Check if tournament is now complete
    if (isTournamentComplete(tournament)) break;

    // Check blind level advancement
    const leveledUp = checkBlindLevelUp(tournament);
    if (leveledUp) {
      const { blindLevel } = tournament.gameState;
      const levelUpEvent = blindLevelUpEvent(
        tournament.gameState.handNumber,
        blindLevel.level,
        blindLevel.sb,
        blindLevel.bb,
        blindLevel.ante,
      );
      onEvent(levelUpEvent);
    }
  }

  // Finalize tournament
  const standings = finalizeTournament(tournament);

  // Emit TOURNAMENT_END event
  const payouts = tournament.eliminations.map((e) => ({
    playerId: e.playerId,
    amount: e.payout,
  }));

  // Add winner payout
  const winner = tournament.gameState.players.find((p) => p.isActive);
  if (winner) {
    const winnerPayout = tournament.config.payoutRatios[0]
      ? Math.floor(tournament.totalChips * tournament.config.payoutRatios[0])
      : 0;
    payouts.push({ playerId: winner.id, amount: winnerPayout });
  }

  onEvent(tournamentEndEvent(tournament.gameState.handNumber, standings, payouts));

  return standings;
}

// ============================================================
// Utility conversion functions
// ============================================================

/**
 * Convert active game players to BettingPlayer format.
 */
function toBettingPlayers(players: { id: string; chips: number; currentBet: number; isFolded: boolean; isAllIn: boolean }[]): BettingPlayer[] {
  return players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));
}

/**
 * Convert game players to PotPlayer format.
 */
function toPotPlayers(players: { id: string; chips: number; currentBet: number; isFolded: boolean; isAllIn: boolean }[]): PotPlayer[] {
  return players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));
}
