# SPEC-AI-008: ICM Calculation Engine & Bubble Factor

## Status: Draft
## Priority: P1 (High)
## Dependencies: SPEC-AI-007 (deterministic RNG required)
## Affected Files: src/ai/icm.ts (new), src/ai/preflop.ts, src/ai/presets.ts, src/engine/tournament.ts

---

## 1. Overview

Implement Independent Chip Model (ICM) equity calculation using the Malmuth-Harville method. Integrate ICM-derived bubble factors into the push/fold and preflop decision engine, making the AI's tournament play sensitive to payout structure, stack positions, and bubble proximity.

Currently, `presets.ts` defines `icmAwareness` (0.0-1.0) and `bubbleTightness` knobs, but no actual ICM computation exists. The push/fold threshold is a fixed linear formula ignoring tournament equity entirely.

## 2. Problem Analysis

### P1: No ICM Equity Calculation

Tournament equity ($EV) is fundamentally different from chip equity (cEV). Near the bubble, losing chips costs more equity than winning chips gains. The current AI treats all chips equally regardless of tournament position, leading to:
- Chip leaders playing too tight (should be pressuring)
- Short stacks not tightening enough near bubble
- Medium stacks calling too liberally when a fold would preserve equity

### P2: Push/Fold Ignores Tournament Context

The `pushFoldDecision` function in `preflop.ts` uses a linear formula `0.65 - (effectiveBB - 1) * 0.06` that only considers stack depth. It ignores:
- Number of players remaining vs payout positions
- Payout structure (top-heavy vs flat)
- Relative stack sizes at the table
- Whether the tournament is on or near the bubble

### P3: Preset Knobs Are Decorative

`icmAwareness` and `bubbleTightness` exist in all 6 presets but have no effect on any decision. The Shark preset has `icmAwareness: 0.9` and `bubbleTightness: 0.7` but plays identically to chip-EV mode.

## 3. Requirements (EARS Format)

### R1: ICM Equity Calculator (Ubiquitous)

**The system shall** provide a function `calculateICM(stacks: number[], payouts: number[]): number[]` that computes each player's tournament equity ($EV) using the Malmuth-Harville model.

- Input: array of stack sizes (chips), array of payout amounts (descending: 1st, 2nd, 3rd...)
- Output: array of equity values (sum equals total prize pool)
- Malmuth-Harville formula: probability of finishing in position k = (stack_i / totalChips) * recursive probability for remaining positions

### R2: Bubble Factor Calculation (Event-Driven)

**When** a push/fold or preflop decision is being made, **the system shall** compute the bubble factor for the acting player:

- `bubbleFactor = equityLostIfBusted / equityGainedIfDoubleUp`
- `equityLostIfBusted = currentEquity - equityAfterLosing(effectiveStack)`
- `equityGainedIfDoubleUp = equityAfterWinning(effectiveStack) - currentEquity`
- Bubble factor > 1.0 means each chip lost costs more equity than each chip won (tighten)
- Bubble factor = 1.0 means chip-EV = $EV (early tournament, deep stacks)

### R3: Push/Fold ICM Adjustment (State-Driven)

**While** `effectiveStackBB <= 10` (push/fold mode), **the system shall** adjust the push threshold:

- Compute ICM bubble factor for the acting player
- `adjustedThreshold = baseThreshold / bubbleFactor`
- When bubble factor is high (e.g., 2.0 near bubble), threshold halves (much tighter)
- When bubble factor is 1.0, no adjustment (same as current)
- Interpolate using `icmAwareness` knob: `finalThreshold = baseThreshold * (1 - icmAwareness) + adjustedThreshold * icmAwareness`

### R4: Preflop Situation Adjustments (State-Driven)

**While** `bubbleFactor > 1.2`, **the system shall** tighten preflop ranges in Situations C, D, and E:

- Situation C (Facing Raise): multiply calling/3-betting cutoffs by `1 / bubbleFactor`
- Situation D (Facing 3-Bet): increase `foldTo3Bet` by `bubbleTightness * (bubbleFactor - 1) * 0.3`
- Situation E (BB Defense): reduce `bbDefenseCutoff` by `bubbleTightness * (bubbleFactor - 1) * 0.2`

### R5: Chip Leader Loosening (State-Driven)

**While** the acting player is the chip leader AND `bubbleFactor > 1.3` for short stacks at the table, **the system shall** widen push ranges by `10-20%` (chip leader can pressure short stacks because they risk less equity).

### R6: icmAwareness Interpolation (Ubiquitous)

**The system shall** use the `icmAwareness` knob (0.0-1.0) to interpolate between chip-EV decisions (awareness=0) and ICM-adjusted decisions (awareness=1):
- `finalDecisionParam = chipEVParam * (1 - icmAwareness) + icmParam * icmAwareness`
- At awareness=0, ICM calculations are performed but have zero effect
- At awareness=1, full ICM adjustment is applied

### R7: bubbleTightness Scaling (Ubiquitous)

**The system shall** use the `bubbleTightness` knob (0.0-1.0) to scale the intensity of bubble pressure:
- `effectiveBubbleFactor = 1 + (rawBubbleFactor - 1) * bubbleTightness`
- At bubbleTightness=0, bubble factor is always 1.0 (no bubble adjustment)
- At bubbleTightness=1, full bubble pressure applied

## 4. Architecture Notes

### New File: src/ai/icm.ts

```
export function calculateICM(stacks: number[], payouts: number[]): number[]
export function computeBubbleFactor(
  stacks: number[], payouts: number[], playerIndex: number, effectiveStack: number
): number
export function icmAdjustedThreshold(
  baseThreshold: number, bubbleFactor: number, icmAwareness: number
): number
```

### Integration Points

1. `preflop.ts` `pushFoldDecision`: call `computeBubbleFactor`, adjust `pushThreshold`
2. `preflop.ts` `situationC/D/E`: pass bubble factor to adjust cutoffs
3. `action-selector.ts` `buildPreflopContext`: add `stacks`, `payouts`, `playerIndex` to PreflopContext
4. Tournament state: `tournament.config.payoutRatios` already has payout structure

### Performance Consideration

ICM calculation is O(n! / (n-k)!) where n=players, k=payout positions. For 8 players and 3 payout positions, this is 336 permutations -- fast enough for real-time. Cache per hand if needed (stacks don't change within a hand).

## 5. Constraints

- ICM calculation must be pure (no side effects, no RNG dependency)
- Bubble factor must be >= 1.0 (by definition, chips lost always cost >= chips gained in equity)
- When only 2 players remain (heads-up), bubble factor should be exactly 1.0 (winner-take-remainder)
- ICM calculation accuracy: must match reference implementations within 0.1% equity

## 6. Traceability

| Requirement | Source | Validates |
|------------|--------|-----------|
| R1 | Design Doc 6.4.3 (ICM) | Tournament equity model |
| R2 | Poker theory (Malmuth) | Bubble factor correctness |
| R3 | preflop.ts pushFoldDecision | Push/fold realism |
| R4 | preflop.ts situationC/D/E | Preflop tightening |
| R5 | Poker theory | Chip leader aggression |
| R6 | presets.ts icmAwareness | Knob activation |
| R7 | presets.ts bubbleTightness | Knob activation |
