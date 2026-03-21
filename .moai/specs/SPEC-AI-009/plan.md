# SPEC-AI-009 Implementation Plan: Nash Push/Fold Tables & Stack-Depth Ranges

## Milestone 1: Nash Push Range Table (Primary Goal)

### Task 1.1: Create src/ai/nash-tables.ts with Push Data

- Define `NASH_PUSH_RANGES` as a nested static object:
  - Key structure: `[effectiveBB][position][playersToAct]` -> percentile threshold
  - effectiveBB: 1-15 (15 values)
  - position: EP, MP, CO, BTN, SB (5 groups; BB uses call table)
  - playersToAct: 1-7
- Populate with Jennings-style Nash equilibrium values
- Reference data points (approximate Nash push ranges at key stack depths):

| Stack | EP (7 to act) | CO (3 to act) | BTN (2 to act) | SB (1 to act) |
|-------|---------------|----------------|-----------------|----------------|
| 1BB   | 0.80          | 0.90           | 0.95            | 1.00           |
| 3BB   | 0.25          | 0.40           | 0.50            | 0.60           |
| 5BB   | 0.15          | 0.28           | 0.38            | 0.48           |
| 8BB   | 0.10          | 0.20           | 0.30            | 0.40           |
| 10BB  | 0.08          | 0.16           | 0.25            | 0.35           |
| 13BB  | 0.05          | 0.12           | 0.18            | 0.28           |
| 15BB  | 0.04          | 0.10           | 0.15            | 0.22           |

- Interpolate linearly for BB values between table entries

### Task 1.2: getNashPushThreshold Function

- Implement lookup with interpolation for non-integer BB values
- Clamp effectiveBB to [1, 15] range
- Map position group to nearest table entry
- Return 0.0 for BB position (BB defends, does not open-push)

**Files created**: `src/ai/nash-tables.ts`

## Milestone 2: Nash Call Range Table (Primary Goal)

### Task 2.1: Add Call Range Data

- Define `NASH_CALL_RANGES` indexed by `[effectiveBB][pushSizeBB]`:
  - effectiveBB: 1-15
  - pushSizeBB: 1-20 (the size of the push in BB)
- Call ranges are tighter than push ranges:

| BB Stack | Facing 3BB Push | Facing 5BB Push | Facing 10BB Push |
|----------|----------------|-----------------|------------------|
| 10BB     | 0.25           | 0.20            | 0.15             |
| 8BB      | 0.30           | 0.25            | 0.18             |
| 5BB      | 0.40           | 0.35            | 0.25             |
| 3BB      | 0.55           | 0.45            | 0.35             |

### Task 2.2: getNashCallThreshold Function

- Implement lookup with interpolation
- Incorporate pot odds: larger push relative to BB means tighter call (worse odds), but this is already reflected in the table
- Return threshold as percentile cutoff

**Files modified**: `src/ai/nash-tables.ts`

## Milestone 3: Ante Adjustment (Primary Goal)

### Task 3.1: Implement applyAnteAdjustment

- Calculate total dead money from antes
- `anteAdjustment = 1 + (totalAntes / (SB + BB)) * 0.3`
- Apply to both push and call thresholds
- Example: With SB=50, BB=100, Ante=15 (BBA, so totalAntes=15):
  - adjustment = 1 + (15/150) * 0.3 = 1.03 (3% wider)
  - With higher antes: adjustment = 1 + (100/150) * 0.3 = 1.20 (20% wider)

### Task 3.2: Plumb Ante Info to Push/Fold

- `PreflopContext` already has `bb` field
- Add `anteBB: number` field (ante amount in BB units)
- Populate from `state.blindLevel.ante / state.blindLevel.bb`

**Files modified**: `src/ai/nash-tables.ts`, `src/ai/preflop.ts`, `src/ai/action-selector.ts`

## Milestone 4: Integration into preflop.ts (Primary Goal)

### Task 4.1: Replace pushFoldDecision Body

- Replace the linear formula with Nash table lookup:
  ```
  // Before:
  const pushThreshold = clamp01(effectiveStackBB <= 1 ? 0.65 : 0.65 - (effectiveStackBB - 1) * 0.06)

  // After:
  const playersToAct = ctx.activePlayers - 1 // players after this one
  const nashPush = getNashPushThreshold(ctx.effectiveStackBB, ctx.position, playersToAct)
  const anteAdj = applyAnteAdjustment(nashPush, ctx.anteBB)
  const accuracyAdj = anteAdj * (0.7 + 0.3 * ctx.profile.pushFoldAccuracy)
  const pushThreshold = clamp01(accuracyAdj)
  ```

### Task 4.2: Replace Call Threshold

- Replace `callThreshold = pushThreshold * 0.6` with:
  ```
  const pushSizeBB = ctx.facingBet / ctx.bb
  const nashCall = getNashCallThreshold(ctx.effectiveStackBB, pushSizeBB)
  const callAnteAdj = applyAnteAdjustment(nashCall, ctx.anteBB)
  const callAccuracyAdj = callAnteAdj * (0.7 + 0.3 * ctx.profile.pushFoldAccuracy)
  const callThreshold = clamp01(callAccuracyAdj)
  ```

### Task 4.3: Extend Push/Fold Range to 15BB

- Current push/fold activates at `effectiveStackBB <= 10`
- Extend to `effectiveStackBB <= 15` for Nash table coverage
- Between 10-15BB: blend between Nash push/fold and normal open-raise
  - `blendFactor = (15 - effectiveStackBB) / 5` (1.0 at 10BB, 0.0 at 15BB)
  - Decision = blend between push/fold mode and normal preflop mode

### Task 4.4: PreflopContext Additions

- Add `playersToAct: number` -- count of active players who act after the current player
- Add `anteBB: number` -- ante amount divided by BB
- Update `buildPreflopContext` to compute these from game state

**Files modified**: `src/ai/preflop.ts`, `src/ai/action-selector.ts`

## Milestone 5: pushFoldAccuracy Knob (Secondary Goal)

### Task 5.1: Implement Accuracy Interpolation

- `finalThreshold = nashThreshold * (0.7 + 0.3 * accuracy)`
- At accuracy=1.0: multiplier = 1.0 (exact Nash)
- At accuracy=0.5: multiplier = 0.85 (15% tighter than Nash)
- At accuracy=0.0: multiplier = 0.70 (30% tighter than Nash -- exploitably tight)
- Verify preset values produce expected deviations:
  - Shark (0.95): nearly Nash
  - TAG (0.85): slightly tighter
  - Station (0.50): significantly tighter
  - Maniac (0.60): somewhat tighter (but wide VPIP compensates)

**Files modified**: `src/ai/preflop.ts`

## Milestone 6: Testing (Secondary Goal)

### Task 6.1: Nash Table Unit Tests

- Create `tests/ai/nash-tables.test.ts`
- Verify BTN push range > EP push range for same stack depth
- Verify SB has widest push range
- Verify call ranges are tighter than push ranges
- Verify 1BB push approaches 100%
- Verify 15BB push is narrow (< 15%)
- Verify ante adjustment widens ranges

### Task 6.2: Push/Fold Integration Tests

- Compare old linear formula output vs new Nash table output for representative scenarios
- Verify position sensitivity: BTN pushes wider than EP
- Verify accuracy knob produces measurable differences
- Verify Shark plays closer to Nash than Station

### Task 6.3: Smooth Transition Test

- At 10BB: push/fold mode is 100% active
- At 12BB: blend between push/fold and normal preflop
- At 15BB: normal preflop mode is 100% active
- Verify no discontinuous behavior at boundaries

**Files created**: `tests/ai/nash-tables.test.ts`

## Technical Approach

- **Static data**: Nash tables are precomputed constants, no runtime calculation
- **Interpolation**: Linear interpolation for non-integer BB values
- **Backward compatible**: pushFoldAccuracy=0.7 (current lowest non-Station value) produces similar overall tightness to old formula

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Nash table values are incorrect | High - unrealistic AI play | Validate against ICMIZER/SNG Wizard reference |
| 10-15BB blend creates awkward transitions | Medium - AI acts strangely near boundary | Smooth blending with configurable width |
| Existing calibration targets break | Medium | Re-calibrate after integration; focus on directional improvement |
| Table size bloats module | Low (< 10KB) | Static const, tree-shakeable |
