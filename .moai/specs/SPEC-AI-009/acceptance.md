# SPEC-AI-009 Acceptance Criteria: Nash Push/Fold Tables & Stack-Depth Ranges

## AC-1: Position-Differentiated Push Ranges

**Given** effective stack of 8BB and Nash push table
**When** push thresholds are looked up for BTN (2 to act) and EP (7 to act)
**Then** BTN threshold is at least 2x wider than EP threshold
  (e.g., BTN ~30%, EP ~10%)

**Verification**: Unit test on `getNashPushThreshold`.

---

## AC-2: SB Has Widest Push Range

**Given** any effective stack from 1BB to 15BB
**When** push thresholds are compared across all positions
**Then** SB (1 player to act) has the widest push range

**Verification**: Unit test iterating all stack depths.

---

## AC-3: Call Ranges Tighter Than Push Ranges

**Given** effective stack of 8BB
**When** call threshold is compared to push threshold for the same scenario
**Then** call threshold < push threshold (calling requires a stronger hand than pushing)

**Verification**: Unit test comparing push and call thresholds.

---

## AC-4: 1BB Near-Universal Push

**Given** effective stack of 1BB from any position
**When** push threshold is looked up
**Then** threshold >= 0.80 (push with 80%+ of hands -- nearly any two cards)

**Verification**: Unit test on 1BB entries.

---

## AC-5: 15BB Narrow Push Range

**Given** effective stack of 15BB from EP
**When** push threshold is looked up
**Then** threshold <= 0.08 (push with less than 8% of hands -- premium only)

**Verification**: Unit test on 15BB EP entry.

---

## AC-6: Ante Adjustment Widens Ranges

**Given** push threshold of 0.20 and ante = 0.5BB (total dead money from antes)
**When** `applyAnteAdjustment` is called
**Then** adjusted threshold > 0.20 (ranges widen with dead money)
**And** adjustment is proportional to ante/blinds ratio

**Verification**: Unit test with various ante amounts.

---

## AC-7: pushFoldAccuracy Knob Effect

**Given** Shark preset (pushFoldAccuracy=0.95) and Station preset (pushFoldAccuracy=0.50)
**When** push thresholds are computed for 8BB BTN
**Then** Shark threshold is within 5% of raw Nash value
**And** Station threshold is approximately 30% tighter than Shark
**And** the ratio matches the formula: threshold * (0.7 + 0.3 * accuracy)

**Verification**: Unit test comparing accuracy=0.95 vs accuracy=0.50 outputs.

---

## AC-8: Linear Formula Replaced

**Given** the `pushFoldDecision` function in `preflop.ts`
**When** inspected for the linear formula `0.65 - (effectiveBB - 1) * 0.06`
**Then** the formula is no longer present
**And** the function uses `getNashPushThreshold` and `getNashCallThreshold`

**Verification**: Code review + grep for the old formula.

---

## AC-9: Smooth 10-15BB Transition

**Given** effective stacks of 10BB, 12BB, and 15BB for BTN
**When** preflop decisions are computed
**Then** the transition from push/fold mode to normal preflop is gradual:
  - At 10BB: 100% push/fold decision
  - At 12BB: blended decision (50% push/fold weight)
  - At 15BB: 100% normal preflop decision
  - No abrupt behavioral change at boundaries

**Verification**: Integration test measuring decision continuity across stack depths.

---

## AC-10: Players-to-Act Sensitivity

**Given** 8BB stack and CO position
**When** push threshold is computed with 3 players to act vs 5 players to act
**Then** the threshold with 3 players to act is wider (more liberal push)
**And** the threshold with 5 players to act is narrower (more conservative)

**Verification**: Unit test varying playersToAct parameter.

---

## AC-11: No Push Range from BB

**Given** BB position and any stack depth
**When** push threshold is looked up
**Then** push threshold = 0.0 (BB defends or calls, does not open-push)

**Verification**: Unit test on BB position entries.

---

## Quality Gate

- All existing preflop tests pass (no regressions from push/fold change)
- New tests: `nash-tables.test.ts` with position, stack, ante, and accuracy tests
- Push range position ordering: SB > BTN > CO > MP > EP
- Call range < push range invariant holds for all entries
- Smooth transition test passes at 10-15BB boundary

## Definition of Done

- [ ] `src/ai/nash-tables.ts` created with push and call range tables
- [ ] Push table indexed by [effectiveBB][position][playersToAct]
- [ ] Call table indexed by [effectiveBB][pushSizeBB]
- [ ] Ante adjustment function implemented and tested
- [ ] `pushFoldDecision` uses Nash tables instead of linear formula
- [ ] Push/fold extended to 15BB with smooth blending
- [ ] `pushFoldAccuracy` knob produces measurable accuracy variation
- [ ] `playersToAct` and `anteBB` added to PreflopContext
- [ ] All acceptance criteria tests pass
- [ ] Table values validated against Nash equilibrium references
