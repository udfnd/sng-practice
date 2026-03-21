# SPEC-AI-009: Nash Push/Fold Tables & Stack-Depth Ranges

## Status: Draft
## Priority: P2 (Medium)
## Dependencies: SPEC-AI-007 (deterministic RNG), SPEC-AI-008 (ICM for table adjustment)
## Affected Files: src/ai/nash-tables.ts (new), src/ai/preflop.ts, src/ai/presets.ts

---

## 1. Overview

Replace the linear push/fold formula with precomputed Nash equilibrium push and call range tables, indexed by effective stack depth, position, and number of players to act. This transforms the AI's short-stack play from a rough approximation to a game-theory-optimal (GTO) strategy, with the `pushFoldAccuracy` knob controlling deviation from Nash.

## 2. Problem Analysis

### P1: Linear Formula is Position-Blind

Current formula: `pushThreshold = 0.65 - (effectiveBB - 1) * 0.06`

This produces identical push ranges regardless of position. In reality:
- BTN with 8BB should push ~35% of hands (wide, only blinds to act)
- EP with 8BB should push ~15% of hands (6 players to act)
- SB with 8BB should push ~40% of hands (only BB to act)

The linear formula gives ~23% for all positions at 8BB, which is too tight from BTN/SB and too loose from EP.

### P2: No Call Range Distinction

The current `callThreshold = pushThreshold * 0.6` is a crude approximation. Nash call ranges differ fundamentally from push ranges:
- Call ranges are always tighter than push ranges (no fold equity when calling)
- Call ranges depend on push size (pot odds)
- Call ranges depend on position (BB has better odds due to blind already posted)

### P3: No Ante Adjustment

The blind schedule includes antes (BBA), but push/fold ignores them. Dead money from antes widens correct push ranges (more to win) and call ranges (better pot odds).

### P4: Players-to-Act Not Considered

With 8 players at 7BB, pushing from EP faces 7 opponents -- the chance someone wakes up with a calling hand is much higher than pushing from BTN facing only 2 opponents. The current formula ignores this.

## 3. Requirements (EARS Format)

### R1: Nash Push Range Table (Ubiquitous)

**The system shall** include a static lookup table `NASH_PUSH_RANGES` containing push thresholds (percentile cutoffs) indexed by:
- `effectiveStackBB`: 1 through 15 (integer BB values)
- `position`: EP, MP, CO, BTN, SB, BB (6 groups)
- `playersToAct`: 1 through 7

Table values represent the top X% of hands that should push all-in from that position with that stack depth against that many opponents.

### R2: Nash Call Range Table (Ubiquitous)

**The system shall** include a static lookup table `NASH_CALL_RANGES` containing call thresholds indexed by:
- `effectiveStackBB`: 1 through 15
- `pushSizeBB`: the all-in push size (1 through 20, or the push amount in BB)

Call ranges are tighter than push ranges for the same stack depth.

### R3: Ante Adjustment (State-Driven)

**While** antes are present in the blind structure, **the system shall** widen push and call ranges to account for dead money:
- `anteAdjustment = 1 + (totalAntes / (SB + BB)) * 0.3`
- Push threshold is multiplied by `anteAdjustment` (wider range)
- Call threshold uses pot odds including antes

### R4: pushFoldAccuracy Interpolation (Ubiquitous)

**The system shall** use the `pushFoldAccuracy` knob (0.0-1.0) to interpolate between Nash-optimal and exploitable play:
- `accuracy = 1.0`: exact Nash table lookup
- `accuracy = 0.5`: halfway between Nash and a tighter/wider deviation
- `accuracy = 0.0`: play 30% tighter than Nash from all positions (exploitably tight)
- Deviation formula: `finalThreshold = nashThreshold * (0.7 + 0.3 * accuracy)`

### R5: Replace Linear Formula (Event-Driven)

**When** `effectiveStackBB <= 15`, **the system shall** use the Nash table lookup instead of the linear formula for push decisions.

**When** `effectiveStackBB <= 10` and facing an all-in push, **the system shall** use the Nash call table instead of the `pushThreshold * 0.6` formula.

### R6: Position-Specific Push Ranges (Ubiquitous)

**The system shall** produce materially different push ranges by position:
- BTN push range at 8BB shall be at least 2x wider than EP push range at 8BB
- SB push range shall be the widest (only BB to act)
- BB has no push range in standard play (BB defends, does not push preflop unless facing a raise -- use call range)

### R7: Players-to-Act Awareness (Event-Driven)

**When** computing push thresholds, **the system shall** consider the number of players yet to act behind the pushing player:
- Fewer players to act = wider range
- More players to act = tighter range
- Lookup key includes `playersToAct` count

## 4. Architecture Notes

### New File: src/ai/nash-tables.ts

```
export const NASH_PUSH_RANGES: Record<number, Record<PositionGroup, Record<number, number>>>
export const NASH_CALL_RANGES: Record<number, Record<number, number>>
export function getNashPushThreshold(effectiveBB: number, position: PositionGroup, playersToAct: number): number
export function getNashCallThreshold(effectiveBB: number, pushSizeBB: number): number
export function applyAnteAdjustment(threshold: number, anteTotalBB: number): number
```

### Table Data Source

Nash push/fold tables are well-established in poker theory. Reference sources:
- Jennings "Kill Everyone" Nash charts
- ICMIZER Nash equilibrium solver outputs
- Standard SNG push/fold charts (widely published)

The table should be hardcoded as a static constant (no runtime computation). Approximately 15 * 6 * 7 = 630 entries for push ranges, plus 15 * 20 = 300 entries for call ranges.

### Integration into preflop.ts

Replace the body of `pushFoldDecision`:
```
// OLD: const pushThreshold = 0.65 - (effectiveBB - 1) * 0.06
// NEW:
const nashThreshold = getNashPushThreshold(effectiveBB, position, playersToAct)
const anteAdj = applyAnteAdjustment(nashThreshold, anteTotalBB)
const accuracyAdj = anteAdj * (0.7 + 0.3 * profile.pushFoldAccuracy)
// Then apply ICM adjustment from SPEC-AI-008
```

## 5. Constraints

- Table data must be validated against known Nash equilibrium solutions
- Push threshold values must be in [0.0, 1.0] range
- Call threshold must always be <= push threshold for same position/stack
- At 1BB, push threshold approaches 1.0 (push almost any two cards)
- At 15BB, push threshold is narrow (transition to normal open-raise)
- Smooth transition at 15BB boundary between Nash push/fold and normal preflop

## 6. Traceability

| Requirement | Source | Validates |
|------------|--------|-----------|
| R1 | Design Doc 6.4.3 | Nash-approximated ranges |
| R2 | Poker theory | Call vs push distinction |
| R3 | Blind schedule | Ante-inclusive strategy |
| R4 | presets.ts pushFoldAccuracy | Knob activation |
| R5 | preflop.ts pushFoldDecision | Formula replacement |
| R6 | Poker theory | Position sensitivity |
| R7 | Poker theory | Multi-opponent awareness |
