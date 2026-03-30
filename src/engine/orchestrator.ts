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
  isFoldWin,
} from './state-machine';
import {
  resolveAction,
  applyAction,
  isBettingComplete,
  isAllInRunout,
  hasReopen,
  type BettingPlayer,
} from './betting';
import {
  distributePot,
  collectBets,
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
 * Optional async hook called before each AI player action.
 * Used by the game worker to inject visual delays so users can watch AI play.
 *
 * @param playerId The AI player about to act
 */
export type OnBeforeAIAction = (playerId: string) => Promise<void>;

/**
 * Optional async callback invoked after dealing community cards during an all-in runout.
 * Allows the caller (e.g., Web Worker) to add a visual delay between streets.
 */
export type OnRunoutStreetDealt = (street: Street) => Promise<void>;

/**
 * Optional async callback invoked after a hand is complete (showdown + awards done).
 * Allows the caller (e.g., Web Worker) to add a visual delay so users can see results.
 */
export type OnHandComplete = () => Promise<void>;

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
  onBeforeAIAction?: OnBeforeAIAction,
  onRunoutStreetDealt?: OnRunoutStreetDealt,
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
  await runBettingRound(tournament, getAction, events, preflopAggressor, handPrng, (id) => { preflopAggressor = id; }, onBeforeAIAction);

  // Check for fold-win
  if (isFoldWin(gameState)) {
    settleFoldWin(tournament, events);
    return events;
  }

  // Run FLOP, TURN, RIVER streets
  const streets: Street[] = ['FLOP', 'TURN', 'RIVER'];
  for (const street of streets) {
    // Check for all-in runout (skip betting, just deal)
    const bettingPlayers = toBettingPlayers(gameState.players);
    const runout = isAllInRunout(bettingPlayers, gameState.bettingRound);

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

    // During all-in runout, notify caller so they can add a visual delay
    if (runout && onRunoutStreetDealt) {
      await onRunoutStreetDealt(street);
    }

    if (!runout) {
      // Run betting round for this street
      await runBettingRound(tournament, getAction, events, preflopAggressor, handPrng, null, onBeforeAIAction);

      // Check fold-win after each street
      if (isFoldWin(gameState)) {
        settleFoldWin(tournament, events);
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
  onBeforeAIAction?: OnBeforeAIAction,
): Promise<void> {
  const { gameState } = tournament;

  // Build action order for this street
  const actionOrder = getActionOrder(gameState);

  // Map to BettingPlayers
  let bettingPlayers = toBettingPlayers(gameState.players.filter((p) => p.isActive));

  // Check if already done (e.g., all-in runout)
  if (isAllInRunout(bettingPlayers, gameState.bettingRound)) return;
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

    // Compute raise rights: player has reopen right if they haven't acted yet,
    // or if they face a cumulative increase >= lastFullRaiseSize (TDA Rule 47)
    const hasReopenRight = !gameState.bettingRound.actedPlayerIds.includes(bettingPlayer.id)
      || hasReopen(bettingPlayer.id, gameState.bettingRound);

    // Get valid actions
    const validActions = getValidActions(bettingPlayer, gameState.bettingRound, gameState.blindLevel.bb, hasReopenRight);

    // Capture isFacingFirstRaise BEFORE applyAction, because applyAction
    // updates lastAggressorId when this player raises. If captured after,
    // a 3-bet action would set lastAggressorId = player.id, making
    // isFacingFirstRaise false and preventing threeBetOpportunities from counting.
    //
    // isFacingFirstRaise is true only for a genuine 3-bet opportunity:
    // - someone else raised (lastAggressorId set to another player), AND
    // - this player has NOT previously raised (currentBet <= BB means they haven't opened).
    //   If player.currentBet > BB, they already raised and are now facing a 3-bet (SitD),
    //   which should NOT be counted as a 3-bet opportunity.
    const street = gameState.bettingRound.street;
    const isPreflop = street === 'PREFLOP';
    const bb = gameState.blindLevel.bb;
    const playerPreviouslyRaised = player.currentBet > bb;
    const isFacingFirstRaise = isPreflop
      && gameState.bettingRound.lastAggressorId !== null
      && gameState.bettingRound.lastAggressorId !== player.id
      && !playerPreviouslyRaised;

    let actionResult;
    if (!player.isHuman && player.aiProfile) {
      // AI player: use selectAIAction with per-hand PRNG.
      // handPrng must be initialized before any AI action is taken.
      if (!handPrng) throw new Error('handPrng must be initialized before AI actions');

      // Invoke optional pre-action hook (e.g. for visual delay in UI)
      if (onBeforeAIAction) {
        await onBeforeAIAction(player.id);
      }

      const rng = () => nextFloat(handPrng);
      const noLimp = tournament.config.noLimp ?? false;
      actionResult = selectAIAction(player, gameState, preflopAggressor, rng, { noLimp });
    } else {
      // Human player: delegate to ActionProvider
      const response = await getAction(currentPlayerId, validActions, bettingPlayer);
      actionResult = resolveAction(bettingPlayer, response.type, response.amount, gameState.bettingRound);
    }

    applyAction(bettingPlayer, actionResult, gameState.bettingRound);

    // Track preflop aggressor
    if (street === 'PREFLOP' && setPreflopAggressor !== null) {
      if (actionResult.type === 'RAISE' || actionResult.type === 'BET') {
        setPreflopAggressor(player.id);
      }
    }

    // Track stats
    const isBlind = false; // blind posting is separate, not tracked here
    const isRaise = actionResult.type === 'RAISE' || actionResult.type === 'BET';

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
    const chipsDelta = player.currentBet - bettingPlayer.currentBet; // negative = added chips to bet
    player.chips = bettingPlayer.chips;
    player.currentBet = bettingPlayer.currentBet;
    player.isFolded = bettingPlayer.isFolded;
    player.isAllIn = bettingPlayer.isAllIn;
    // Track total hand commitment (currentBet increased → totalHandBet increased)
    if (chipsDelta < 0) {
      player.totalHandBet += -chipsDelta;
    }

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
    if (isAllInRunout(bettingPlayers, gameState.bettingRound)) break;

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
 * Settle a fold-win hand with proper event emission.
 * Order: uncalled return → collect bets → award pot → HAND_COMPLETE
 * Events emitted match exactly what happened in state.
 */
function settleFoldWin(tournament: TournamentState, events: GameEvent[]): void {
  const { gameState, totalChips } = tournament;
  const handNumber = gameState.handNumber;

  const nonFolded = gameState.players.filter((p) => p.isActive && !p.isFolded);
  if (nonFolded.length !== 1) {
    throw new Error(`settleFoldWin requires exactly 1 non-folded player, got ${nonFolded.length}`);
  }
  const winner = nonFolded[0]!;

  // Step 1: Return uncalled bet
  handleUncalledBet(tournament, events);

  // Step 2: Collect remaining bets into pot
  const potPlayers = gameState.players.map((p) => ({
    id: p.id,
    chips: p.chips,
    currentBet: p.currentBet,
    isFolded: p.isFolded,
    isAllIn: p.isAllIn,
  }));
  const result = collectBets(potPlayers, gameState.mainPot, gameState.sidePots);
  gameState.mainPot = result.mainPot;
  gameState.sidePots = result.sidePots;
  for (const p of gameState.players) {
    const pp = potPlayers.find((pp) => pp.id === p.id)!;
    p.currentBet = pp.currentBet;
    p.chips = pp.chips;
  }

  // Step 3: Calculate total pot and award to winner
  const totalPot = gameState.mainPot + gameState.sidePots.reduce((sum, sp) => sum + sp.amount, 0);
  winner.chips += totalPot;
  gameState.mainPot = 0;
  gameState.sidePots = [];

  // Step 4: Emit AWARD_POT with correct post-uncalled amount
  events.push(
    awardPotEvent(handNumber, 0, [{ playerId: winner.id, amount: totalPot }]),
  );

  assertChipInvariant(
    toPotPlayers(gameState.players),
    gameState.mainPot,
    gameState.sidePots,
    totalChips,
  );

  // Step 5: Transition to HAND_COMPLETE
  transitionToHandComplete(gameState);
}

/**
 * Return uncalled bet to the last aggressor if their bet exceeds the second-highest bet.
 *
 * The second-highest bet must include ALL active players (including folded ones),
 * because folded players' currentBet represents matched money already committed.
 * Ignoring folded players would over-return chips and distort pot distribution.
 */
function handleUncalledBet(tournament: TournamentState, events: GameEvent[]): void {
  const { gameState } = tournament;

  // The last bettor/raiser is always a non-folded player with the highest bet.
  const nonFolded = gameState.players.filter((p) => p.isActive && !p.isFolded);
  if (nonFolded.length < 1) return;

  const sortedNonFolded = nonFolded
    .map((p) => ({ id: p.id, bet: p.currentBet }))
    .sort((a, b) => b.bet - a.bet);

  const highestBet = sortedNonFolded[0]!.bet;
  const lastBettorId = sortedNonFolded[0]!.id;

  // Second-highest bet from ANY active player (including folded).
  // Folded players' currentBet is still matched money that counts toward pot construction.
  const secondBet = gameState.players
    .filter((p) => p.isActive && p.id !== lastBettorId)
    .reduce((max, p) => Math.max(max, p.currentBet), 0);

  const uncalledAmount = calcUncalledBet(highestBet, secondBet);

  if (uncalledAmount > 0) {
    const player = gameState.players.find((p) => p.id === lastBettorId);
    if (player) {
      player.currentBet -= uncalledAmount;
      player.chips += uncalledAmount;
      events.push(uncalledReturnEvent(gameState.handNumber, lastBettorId, uncalledAmount));
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
        handDescription: r.hand.description,
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

  // TDA standard: settle side pots first (most restricted → least restricted), then main pot.
  // Reverse order: last side pot created = most restricted (fewest eligible players).
  // potIndex: 0 = main pot (settled last), 1+ = side pots (semantic, matches reducer expectations)
  let sidePotIndex = gameState.sidePots.length; // start from highest, count down
  const reversedSidePots = [...gameState.sidePots].reverse();
  for (const sidePot of reversedSidePots) {
    const sidePotEligible = reveals.filter((r) =>
      sidePot.eligiblePlayerIds.includes(r.playerId),
    );

    // Empty eligible set = upstream bug in pot calculation. Fail fast.
    if (sidePotEligible.length === 0) {
      throw new Error(
        `Side pot ${sidePotIndex} has no eligible players at showdown. ` +
        `Eligible IDs: [${sidePot.eligiblePlayerIds.join(',')}], ` +
        `Reveal IDs: [${reveals.map((r) => r.playerId).join(',')}]`
      );
    }

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

    events.push(awardPotEvent(gameState.handNumber, sidePotIndex--, payouts));
  }
  gameState.sidePots = [];

  // Main pot: all non-folded eligible players (settled last per TDA, potIndex=0)
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

    events.push(awardPotEvent(gameState.handNumber, 0, payouts));
  }

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
  onBeforeAIAction?: OnBeforeAIAction,
  onRunoutStreetDealt?: OnRunoutStreetDealt,
  onHandComplete?: OnHandComplete,
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
    const handEvents = await runHand(tournament, getAction, onBeforeAIAction, onRunoutStreetDealt);

    // Emit all events
    for (const event of handEvents) {
      onEvent(event);
    }

    // Pause after hand complete so users can see showdown results
    if (onHandComplete) {
      await onHandComplete();
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
