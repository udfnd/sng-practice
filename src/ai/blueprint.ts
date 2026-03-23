import type { AIProfile } from '@/types';
import type { HandBucket, StrategyKey, RelativePosition, ActionLine, SPRBucket } from './strategy-key';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Available actions in a mixed policy.
 * Numbers are basis points (0-1000, sum = 1000).
 */
export interface MixedPolicy {
  check: number;
  bet33: number;
  bet66: number;
  bet100: number;
  fold: number;
  call: number;
  raise: number;
}

/**
 * Resolved action from policy sampling.
 */
export interface BlueprintAction {
  type: 'CHECK' | 'BET' | 'FOLD' | 'CALL' | 'RAISE';
  sizePctPot: number; // 0 for check/fold/call, 33/66/100 for bets
}

// ---------------------------------------------------------------------------
// Policy overrides (JSON-loadable, empty for v1)
// ---------------------------------------------------------------------------

/** Override entries keyed by simplified strategy key string */
const policyOverrides: Map<string, Partial<Record<HandBucket, MixedPolicy>>> = new Map();

/**
 * Register a policy override for a specific node.
 * Used for JSON-loaded overrides in future versions.
 */
export function registerOverride(
  keyPattern: string,
  handPolicies: Partial<Record<HandBucket, MixedPolicy>>,
): void {
  policyOverrides.set(keyPattern, handPolicies);
}

// ---------------------------------------------------------------------------
// Core pipeline: StrategyKey → baseline → override → deviation → sample
// ---------------------------------------------------------------------------

/**
 * Look up or generate a mixed policy for the given strategy key.
 */
export function lookupPolicy(key: StrategyKey): MixedPolicy {
  // Step 1: Check overrides
  const overrideKey = buildOverrideKey(key);
  const override = policyOverrides.get(overrideKey);
  if (override && override[key.hand]) {
    return override[key.hand]!;
  }

  // Step 2: Generate programmatic baseline
  return generateBaseline(key);
}

/**
 * Apply profile deviation to a baseline policy.
 * Bounded to ±80 basis points (±8%) per action to keep personality subtle.
 */
export function applyDeviation(
  policy: MixedPolicy,
  profile: AIProfile,
  isFacingBet: boolean,
): MixedPolicy {
  const result = { ...policy };
  const MAX_DEV = 80; // ±8% max deviation

  if (isFacingBet) {
    // Defense adjustments: foldToCBet affects fold frequency
    const foldDev = Math.round((profile.foldToCBet - 0.45) * 200); // 0.45 = baseline
    result.fold = clamp(result.fold + clampDev(foldDev, MAX_DEV), 0, 1000);
    result.call = clamp(result.call - clampDev(foldDev, MAX_DEV), 0, 1000);

    // Check-raise tendencies
    const crDev = Math.round((profile.checkRaiseFreq - 0.06) * 500);
    result.raise = clamp(result.raise + clampDev(crDev, MAX_DEV), 0, 1000);
    result.call = clamp(result.call - clampDev(crDev, MAX_DEV / 2), 0, 1000);
  } else {
    // Aggressor adjustments: cBetFreq/bluffFreq affect bet frequency
    const betDev = Math.round((profile.cBetFreq - 0.65) * 200);
    const totalBet = result.bet33 + result.bet66 + result.bet100;
    if (totalBet > 0) {
      const scale = clampDev(betDev, MAX_DEV);
      result.bet33 = clamp(result.bet33 + Math.round(scale * result.bet33 / totalBet), 0, 1000);
      result.bet66 = clamp(result.bet66 + Math.round(scale * result.bet66 / totalBet), 0, 1000);
      result.bet100 = clamp(result.bet100 + Math.round(scale * result.bet100 / totalBet), 0, 1000);
      result.check = clamp(result.check - scale, 0, 1000);
    }

    // Bluff tendency for air hands
    const bluffDev = Math.round((profile.bluffFreq - 0.15) * 200);
    result.bet33 = clamp(result.bet33 + clampDev(bluffDev, MAX_DEV / 2), 0, 1000);
    result.check = clamp(result.check - clampDev(bluffDev, MAX_DEV / 2), 0, 1000);
  }

  // Normalize to 1000
  return normalizePolicy(result);
}

/**
 * Sample an action from a mixed policy using RNG.
 */
export function sampleAction(policy: MixedPolicy, rng: () => number): BlueprintAction {
  const roll = Math.round(rng() * 1000);
  let cumulative = 0;

  cumulative += policy.check;
  if (roll < cumulative) return { type: 'CHECK', sizePctPot: 0 };

  cumulative += policy.bet33;
  if (roll < cumulative) return { type: 'BET', sizePctPot: 33 };

  cumulative += policy.bet66;
  if (roll < cumulative) return { type: 'BET', sizePctPot: 66 };

  cumulative += policy.bet100;
  if (roll < cumulative) return { type: 'BET', sizePctPot: 100 };

  cumulative += policy.fold;
  if (roll < cumulative) return { type: 'FOLD', sizePctPot: 0 };

  cumulative += policy.call;
  if (roll < cumulative) return { type: 'CALL', sizePctPot: 0 };

  // Raise (or rounding overflow fallback)
  if (policy.raise > 0) return { type: 'RAISE', sizePctPot: 300 };

  // Rounding edge case: fall back to the largest non-zero action
  if (policy.check > 0) return { type: 'CHECK', sizePctPot: 0 };
  if (policy.call > 0) return { type: 'CALL', sizePctPot: 0 };
  if (policy.fold > 0) return { type: 'FOLD', sizePctPot: 0 };
  return { type: 'CHECK', sizePctPot: 0 };
}

// ---------------------------------------------------------------------------
// Programmatic baseline generator
// ---------------------------------------------------------------------------

/**
 * Generate a GTO-inspired baseline policy for any strategy key.
 * Based on solver heuristics:
 * - Range advantage drives bet frequency
 * - Nut advantage drives bet sizing
 * - SPR drives commitment threshold
 * - Hand bucket determines action distribution
 */
function generateBaseline(key: StrategyKey): MixedPolicy {
  const isFacing = key.line.startsWith('vs');
  if (isFacing) return generateDefenseBaseline(key);
  return generateAggressorBaseline(key);
}

function generateAggressorBaseline(key: StrategyKey): MixedPolicy {
  // Base frequencies by hand bucket (flop first action, SRP, IP, medium SPR)
  const basePolicy = getHandBucketAggressorBase(key.hand);

  // Adjust for position
  if (key.position === 'OOP') {
    // OOP checks more, bets less frequently but more polarized
    basePolicy.check = Math.round(basePolicy.check * 1.25);
    basePolicy.bet33 = Math.round(basePolicy.bet33 * 0.7);
    basePolicy.bet66 = Math.round(basePolicy.bet66 * 0.9);
    // OOP uses more overbets when betting
    basePolicy.bet100 = Math.round(basePolicy.bet100 * 1.2);
  }

  // Adjust for board cluster (range advantage)
  applyBoardAdjustment(basePolicy, key.board, key.position);

  // Adjust for SPR
  applySPRAdjustment(basePolicy, key.spr);

  // Adjust for pot type (3BP = more checking, smaller sizing)
  if (key.potType === '3BP' || key.potType === '4BP') {
    basePolicy.check = Math.round(basePolicy.check * 1.15);
    basePolicy.bet33 = Math.round(basePolicy.bet33 * 1.3);
    basePolicy.bet66 = Math.round(basePolicy.bet66 * 0.8);
    basePolicy.bet100 = Math.round(basePolicy.bet100 * 0.7);
  }

  // Adjust for ICM stage
  if (key.stage === 'bubble') {
    // Bubble: bet less, check more (risk aversion)
    basePolicy.check = Math.round(basePolicy.check * 1.3);
    basePolicy.bet66 = Math.round(basePolicy.bet66 * 0.7);
    basePolicy.bet100 = Math.round(basePolicy.bet100 * 0.5);
  }

  // Adjust for street
  if (key.street === 'TURN') {
    // Turn: slightly less frequent, slightly larger sizes
    basePolicy.check = Math.round(basePolicy.check * 1.1);
    basePolicy.bet33 = Math.round(basePolicy.bet33 * 0.8);
    basePolicy.bet66 = Math.round(basePolicy.bet66 * 1.1);
  } else if (key.street === 'RIVER') {
    // River: polarized (value or bluff, less medium sizing)
    basePolicy.bet33 = Math.round(basePolicy.bet33 * 0.5);
    basePolicy.bet100 = Math.round(basePolicy.bet100 * 1.3);
  }

  // Adjust for action line
  if (key.line === 'afterXX') {
    // After check-check: delayed c-bet, smaller sizes
    basePolicy.bet33 = Math.round(basePolicy.bet33 * 1.3);
    basePolicy.bet66 = Math.round(basePolicy.bet66 * 0.9);
    basePolicy.check = Math.round(basePolicy.check * 1.1);
  }

  return normalizePolicy(basePolicy);
}

function generateDefenseBaseline(key: StrategyKey): MixedPolicy {
  const basePolicy = getHandBucketDefenseBase(key.hand, key.line);

  // Adjust for position
  if (key.position === 'IP') {
    // IP defender can call wider (positional advantage post-flop)
    basePolicy.fold = Math.round(basePolicy.fold * 0.85);
    basePolicy.call = Math.round(basePolicy.call * 1.1);
  }

  // Adjust for board texture (check-raise frequency)
  applyBoardDefenseAdjust(basePolicy, key.board);

  // Adjust for bet size (pot odds)
  applyBetSizeDefenseAdjust(basePolicy, key.line);

  // Adjust for SPR
  if (key.spr === 'lt2' || key.spr === '2to4') {
    // Short SPR: commit or fold, less calling
    basePolicy.raise = Math.round(basePolicy.raise * 1.5);
    basePolicy.call = Math.round(basePolicy.call * 0.7);
  }

  // Adjust for ICM
  if (key.stage === 'bubble') {
    basePolicy.fold = Math.round(basePolicy.fold * 1.2);
    basePolicy.raise = Math.round(basePolicy.raise * 0.6);
  }

  // Adjust for 3BP
  if (key.potType === '3BP' || key.potType === '4BP') {
    // In 3BP+ pots, ranges are narrower, less folding
    basePolicy.fold = Math.round(basePolicy.fold * 0.85);
    basePolicy.call = Math.round(basePolicy.call * 1.1);
  }

  return normalizePolicy(basePolicy);
}

// ---------------------------------------------------------------------------
// Hand bucket base policies
// ---------------------------------------------------------------------------

/**
 * Base aggressor (betting) policy per hand bucket.
 * Values approximate solver outputs for SRP IP FLOP first action.
 * Format: check / bet33 / bet66 / bet100 / fold / call / raise (sum ~1000)
 */
function getHandBucketAggressorBase(hand: HandBucket): MixedPolicy {
  switch (hand) {
    // Nutted hands: bet for value, mix sizes
    case 'nuts':
      return { check: 100, bet33: 150, bet66: 350, bet100: 400, fold: 0, call: 0, raise: 0 };
    case 'strong_value':
      return { check: 150, bet33: 200, bet66: 400, bet100: 250, fold: 0, call: 0, raise: 0 };
    case 'overpair':
      return { check: 200, bet33: 350, bet66: 350, bet100: 100, fold: 0, call: 0, raise: 0 };

    // Top pair: mostly small-medium bets
    case 'tp_good':
      return { check: 250, bet33: 450, bet66: 250, bet100: 50, fold: 0, call: 0, raise: 0 };
    case 'tp_weak':
      return { check: 380, bet33: 400, bet66: 180, bet100: 40, fold: 0, call: 0, raise: 0 };

    // Medium hands: check more often
    case 'second_pair':
      return { check: 550, bet33: 300, bet66: 120, bet100: 30, fold: 0, call: 0, raise: 0 };
    case 'weak_pair':
      return { check: 650, bet33: 250, bet66: 80, bet100: 20, fold: 0, call: 0, raise: 0 };

    // Draws: semi-bluff with sizing that builds pot
    case 'nut_fd':
      return { check: 250, bet33: 200, bet66: 350, bet100: 200, fold: 0, call: 0, raise: 0 };
    case 'flush_draw':
      return { check: 350, bet33: 250, bet66: 300, bet100: 100, fold: 0, call: 0, raise: 0 };
    case 'oesd':
      return { check: 400, bet33: 280, bet66: 250, bet100: 70, fold: 0, call: 0, raise: 0 };
    case 'pair_plus_draw':
      return { check: 200, bet33: 250, bet66: 350, bet100: 200, fold: 0, call: 0, raise: 0 };
    case 'gutshot_overs':
      return { check: 550, bet33: 250, bet66: 150, bet100: 50, fold: 0, call: 0, raise: 0 };

    // Showdown value: check mostly
    case 'Ahi_bdfd':
      return { check: 600, bet33: 250, bet66: 120, bet100: 30, fold: 0, call: 0, raise: 0 };
    case 'showdown_high':
      return { check: 700, bet33: 200, bet66: 80, bet100: 20, fold: 0, call: 0, raise: 0 };

    // Bluffs: mix small bets with checking
    case 'blocker_bluff':
      return { check: 600, bet33: 200, bet66: 150, bet100: 50, fold: 0, call: 0, raise: 0 };
    case 'air':
      return { check: 750, bet33: 130, bet66: 80, bet100: 40, fold: 0, call: 0, raise: 0 };

    default:
      return { check: 600, bet33: 200, bet66: 150, bet100: 50, fold: 0, call: 0, raise: 0 };
  }
}

/**
 * Base defense (facing bet) policy per hand bucket.
 */
function getHandBucketDefenseBase(hand: HandBucket, _line: ActionLine): MixedPolicy {
  // Base: fold/call/raise (check not available when facing bet)
  switch (hand) {
    case 'nuts':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 0, call: 200, raise: 800 };
    case 'strong_value':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 0, call: 400, raise: 600 };
    case 'overpair':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 20, call: 650, raise: 330 };
    case 'tp_good':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 30, call: 780, raise: 190 };
    case 'tp_weak':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 80, call: 800, raise: 120 };
    case 'second_pair':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 200, call: 720, raise: 80 };
    case 'weak_pair':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 350, call: 580, raise: 70 };

    // Draws: call or raise (semi-bluff)
    case 'nut_fd':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 30, call: 500, raise: 470 };
    case 'flush_draw':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 80, call: 650, raise: 270 };
    case 'oesd':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 150, call: 650, raise: 200 };
    case 'pair_plus_draw':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 30, call: 520, raise: 450 };
    case 'gutshot_overs':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 300, call: 580, raise: 120 };

    // Showdown: mostly call small, fold to big
    case 'Ahi_bdfd':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 350, call: 580, raise: 70 };
    case 'showdown_high':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 450, call: 500, raise: 50 };

    // Bluffs: mostly fold, occasional raise as bluff
    case 'blocker_bluff':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 650, call: 200, raise: 150 };
    case 'air':
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 800, call: 150, raise: 50 };

    default:
      return { check: 0, bet33: 0, bet66: 0, bet100: 0, fold: 500, call: 400, raise: 100 };
  }
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

function applyBoardAdjustment(policy: MixedPolicy, boardCluster: string, position: RelativePosition): void {
  const flopCluster = boardCluster.split('|')[0] ?? '';

  // Raiser-favoring boards: bet more, prefer small sizing
  if (['Ahi_dry', 'Khi_dry'].includes(flopCluster)) {
    policy.bet33 = Math.round(policy.bet33 * 1.3);
    policy.check = Math.round(policy.check * 0.8);
  }

  // Caller-favoring boards: check more, less range betting
  if (['low_conn_2tone', 'low_dry', 'mid_dynamic'].includes(flopCluster)) {
    policy.check = Math.round(policy.check * 1.3);
    policy.bet33 = Math.round(policy.bet33 * 0.7);
    // But when betting, use larger sizes (polarized)
    policy.bet66 = Math.round(policy.bet66 * 1.2);
  }

  // Monotone boards: check more (nut advantage unclear)
  if (flopCluster === 'monotone') {
    policy.check = Math.round(policy.check * 1.4);
    policy.bet33 = Math.round(policy.bet33 * 0.6);
    policy.bet66 = Math.round(policy.bet66 * 0.8);
  }

  // Paired boards: small c-bet at high frequency (IP), check more (OOP)
  if (flopCluster === 'paired_high' || flopCluster === 'paired_low') {
    if (position === 'IP') {
      policy.bet33 = Math.round(policy.bet33 * 1.4);
      policy.bet66 = Math.round(policy.bet66 * 0.7);
    } else {
      policy.check = Math.round(policy.check * 1.2);
    }
  }

  // Broadway connected: medium sizing, moderate frequency
  if (flopCluster === 'broadway_conn') {
    policy.bet66 = Math.round(policy.bet66 * 1.15);
    policy.bet33 = Math.round(policy.bet33 * 0.9);
  }
}

function applySPRAdjustment(policy: MixedPolicy, spr: SPRBucket): void {
  if (spr === 'lt2') {
    // Very short SPR: jam or check, no small bets
    policy.bet100 = Math.round((policy.bet33 + policy.bet66 + policy.bet100) * 1.0);
    policy.bet33 = 0;
    policy.bet66 = 0;
  } else if (spr === '2to4') {
    // Short SPR: prefer larger sizes
    policy.bet100 = Math.round(policy.bet100 * 1.5);
    policy.bet66 = Math.round(policy.bet66 * 1.2);
    policy.bet33 = Math.round(policy.bet33 * 0.5);
  } else if (spr === '8plus') {
    // Deep: prefer smaller sizes
    policy.bet33 = Math.round(policy.bet33 * 1.3);
    policy.bet66 = Math.round(policy.bet66 * 0.9);
    policy.bet100 = Math.round(policy.bet100 * 0.6);
  }
}

function applyBoardDefenseAdjust(policy: MixedPolicy, boardCluster: string): void {
  const flopCluster = boardCluster.split('|')[0] ?? '';

  // Wet/dynamic boards: more check-raising (draws have equity, board favors caller)
  if (['mid_dynamic', 'low_conn_2tone', 'broadway_conn'].includes(flopCluster)) {
    policy.raise = Math.round(policy.raise * 1.4);
    policy.call = Math.round(policy.call * 0.9);
  }

  // Monotone boards: more check-raising (flush draws, board favors caller)
  if (flopCluster === 'monotone') {
    policy.raise = Math.round(policy.raise * 1.3);
    policy.call = Math.round(policy.call * 0.9);
  }

  // Dry boards: less check-raising (raiser has advantage, fewer draws)
  if (['Ahi_dry', 'Khi_dry', 'low_dry', 'mid_dry'].includes(flopCluster)) {
    policy.raise = Math.round(policy.raise * 0.5);
    policy.call = Math.round(policy.call * 1.1);
  }

  // Paired boards: slightly less check-raising
  if (flopCluster === 'paired_high' || flopCluster === 'paired_low') {
    policy.raise = Math.round(policy.raise * 0.7);
    policy.call = Math.round(policy.call * 1.05);
  }
}

function applyBetSizeDefenseAdjust(policy: MixedPolicy, line: ActionLine): void {
  // Smaller bet = need to defend wider (better pot odds)
  if (line === 'vs25' || line === 'vs33') {
    policy.fold = Math.round(policy.fold * 0.6);
    policy.call = Math.round(policy.call * 1.3);
  }
  // Larger bet = can fold more
  if (line === 'vs100' || line === 'vsOverbet') {
    policy.fold = Math.round(policy.fold * 1.3);
    policy.call = Math.round(policy.call * 0.8);
    policy.raise = Math.round(policy.raise * 0.7);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildOverrideKey(key: StrategyKey): string {
  return `${key.stage}|${key.potType}|${key.position}|${key.street}|${key.line}|${key.spr}|${key.board}`;
}

function normalizePolicy(p: MixedPolicy): MixedPolicy {
  const total = p.check + p.bet33 + p.bet66 + p.bet100 + p.fold + p.call + p.raise;
  if (total === 0) return { check: 1000, bet33: 0, bet66: 0, bet100: 0, fold: 0, call: 0, raise: 0 };
  const scale = 1000 / total;
  return {
    check: Math.round(p.check * scale),
    bet33: Math.round(p.bet33 * scale),
    bet66: Math.round(p.bet66 * scale),
    bet100: Math.round(p.bet100 * scale),
    fold: Math.round(p.fold * scale),
    call: Math.round(p.call * scale),
    raise: Math.round(p.raise * scale),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampDev(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}
