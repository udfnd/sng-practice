// ============================================================
// Core Types — Texas Hold'em 8-Max SNG Practice Tool
// Design Doc v4.2, Section 7
// ============================================================

// --- Card ---

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

/** Display rank: 2–14 where 14 = Ace */
export type DisplayRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  /** encoded = suit_index * 13 + rank_index (0-based, 0–51) */
  encoded: number;
  suit: Suit;
  rank: DisplayRank;
}

// --- Action & Betting ---

export type ActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE';

export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';

export interface Action {
  playerId: string;
  type: ActionType;
  /** FOLD/CHECK = 0, CALL = min(facingBet, stack+currentBet), BET/RAISE = total amount */
  amount: number;
  raiseIncrement: number;
  isAllIn: boolean;
  street: Street;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface BettingRoundState {
  street: Street;
  currentBet: number;
  /** Tracks last full raise for re-open determination */
  lastFullRaiseSize: number;
  lastAggressorId: string | null;
  /** Players who have acted this round (Set → string[] for JSON safety) */
  actedPlayerIds: string[];
  /** Each player's last faced bet amount (for cumulative re-open) */
  playerLastFacedBet: Record<string, number>;
}

// --- Player ---

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  /** Stack bucket */
  chips: number;
  /** StreetBets bucket */
  currentBet: number;
  totalHandBet: number;
  holeCards: [Card, Card] | null;
  isHuman: boolean;
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  aiProfile: AIProfile | null;
  stats: PlayerStats;
}

// --- AI ---

export type PresetType = 'Nit' | 'TAG' | 'LAG' | 'Station' | 'Maniac' | 'Shark';

export interface AIProfile {
  presetType: PresetType;
  /** All ratios stored as 0.0–1.0 internally */
  vpip: number;
  pfr: number;
  threeBetFreq: number;
  foldTo3Bet: number;
  /** Open range portion for 4-bet (0.10–0.30) */
  fourBetRatio: number;
  /** BB multiplier (2.0–4.0) */
  openRaiseSize: number;
  openLimpFreq: number;
  positionAwareness: number;
  cBetFreq: number;
  /** Pot fraction (0.25–1.0) */
  cBetSize: number;
  turnBarrel: number;
  riverBarrel: number;
  foldToCBet: number;
  checkRaiseFreq: number;
  bluffFreq: number;
  icmAwareness: number;
  pushFoldAccuracy: number;
  stackSizeAdjust: number;
  bubbleTightness: number;
  /** BB defense base width (0.15–0.50) */
  bbDefenseBase: number;
}

// --- Stats ---

export interface PlayerStats {
  /** Cards dealt minus walk hands */
  handsEligible: number;
  vpipCount: number;
  pfrCount: number;
  /** Times facing first raise preflop */
  threeBetOpportunities: number;
  threeBetCount: number;
  /** Flop C-bet opportunities (PFR aggressor, no prior bet) */
  cBetOpportunities: number;
  cBetCount: number;
  wentToShowdown: number;
  wonAtShowdown: number;
}

// --- Game ---

export type GamePhase =
  | 'WAITING'
  | 'RESOLVE_SEATS'
  | 'POSTING_BLINDS'
  | 'DEALING'
  | 'PREFLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'HAND_COMPLETE';

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  /** BBA amount (Big Blind Ante) */
  ante: number;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  communityCards: Card[];
  /** Pots bucket: main pot */
  mainPot: number;
  /** Pots bucket: side pots */
  sidePots: SidePot[];
  currentPlayerIndex: number;
  buttonSeatIndex: number;
  sbSeatIndex: number;
  bbSeatIndex: number;
  blindLevel: BlindLevel;
  handsPlayedInLevel: number;
  handNumber: number;
  actionHistory: Action[];
  bettingRound: BettingRoundState;
  seed: string;
}

// --- Tournament ---

export interface TournamentConfig {
  playerCount: 8;
  startingChips: number;
  handsPerLevel: number;
  blindSchedule: BlindLevel[];
  payoutStructure: 'top2' | 'top3';
  payoutRatios: number[];
  initialSeed: string | null;
}

export interface TournamentState {
  tournamentId: string;
  config: TournamentConfig;
  gameState: GameState;
  eliminations: Elimination[];
  standings: Standing[];
  isComplete: boolean;
  currentBlindLevelIndex: number;
  /** Invariant = startingChips * 8 */
  totalChips: number;
}

export interface Elimination {
  playerId: string;
  handNumber: number;
  finishPosition: number;
  chipsAtHandStart: number;
  payout: number;
}

export interface Standing {
  playerId: string;
  position: number;
  chips: number;
  handsPlayed: number;
}

// --- Events ---

export type GameEventType =
  | 'HAND_START'
  | 'POST_BLIND'
  | 'DEAL_HOLE'
  | 'DEAL_COMMUNITY'
  | 'PLAYER_ACTION'
  | 'UNCALLED_RETURN'
  | 'SHOWDOWN'
  | 'AWARD_POT'
  | 'PLAYER_ELIMINATED'
  | 'BLIND_LEVEL_UP'
  | 'TOURNAMENT_END';

export interface GameEvent {
  type: GameEventType;
  /** Non-canonical: debug/UI only, excluded from determinism comparison */
  timestamp: number;
  handNumber: number;
  /** Monotonically increasing within hand (0, 1, 2, ...) */
  sequenceIndex: number;
  payload: EventPayload;
}

export type EventPayload =
  | HandStartPayload
  | PostBlindPayload
  | DealHolePayload
  | DealCommunityPayload
  | PlayerActionPayload
  | UncalledReturnPayload
  | ShowdownPayload
  | AwardPotPayload
  | PlayerEliminatedPayload
  | BlindLevelUpPayload
  | TournamentEndPayload;

export interface HandStartPayload {
  type: 'HAND_START';
  handNumber: number;
  seed: string;
  blindLevel: BlindLevel;
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  stacks: { playerId: string; chips: number }[];
}

export interface PostBlindPayload {
  type: 'POST_BLIND';
  playerId: string;
  amount: number;
  blindType: 'SB' | 'BB' | 'BBA';
}

export interface DealHolePayload {
  type: 'DEAL_HOLE';
  playerId: string;
  cards: [Card, Card];
}

export interface DealCommunityPayload {
  type: 'DEAL_COMMUNITY';
  cards: Card[];
  street: Street;
}

export interface PlayerActionPayload {
  type: 'PLAYER_ACTION';
  playerId: string;
  action: ActionType;
  amount: number;
  isAllIn: boolean;
}

export interface UncalledReturnPayload {
  type: 'UNCALLED_RETURN';
  playerId: string;
  amount: number;
}

export interface ShowdownPayload {
  type: 'SHOWDOWN';
  reveals: { playerId: string; cards: [Card, Card]; handRank: number }[];
}

export interface AwardPotPayload {
  type: 'AWARD_POT';
  potIndex: number;
  payouts: { playerId: string; amount: number }[];
}

export interface PlayerEliminatedPayload {
  type: 'PLAYER_ELIMINATED';
  playerId: string;
  finishPosition: number;
  payout: number;
}

export interface BlindLevelUpPayload {
  type: 'BLIND_LEVEL_UP';
  newLevel: number;
  sb: number;
  bb: number;
  ante: number;
}

export interface TournamentEndPayload {
  type: 'TOURNAMENT_END';
  standings: Standing[];
  payouts: { playerId: string; amount: number }[];
}

// --- Storage ---

export interface StorageEnvelope<T> {
  schemaVersion: number;
  data: T;
  savedAt: number;
}
