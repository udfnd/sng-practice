# SPEC-AI-002: Preflop Decision Engine

## Status: Draft
## Phase: 2 (AI + Tournament)
## Priority: P0 (Critical)
## Dependencies: SPEC-AI-001, SPEC-ENGINE-004

---

## 1. Overview

Implement the preflop decision engine using a 5-situation state machine (Unopened, Limped, Facing First Raise, Facing 3-Bet, BB Defense). Includes re-raise sizing policy, push/fold mode, and stack/tournament adjustments.

## 2. Requirements (EARS Format)

### R1: Situation A — Unopened Pot
**When** no limper and no raise, **the system shall**:
- percentile ≤ pfr → open raise (size: max(2×BB, openRaiseSize ± 0.5BB noise))
- pfr < percentile ≤ pfr + openLimpFreq → open limp
- percentile > pfr + openLimpFreq → fold

### R2: Situation B — Limped Pot
**When** limpers exist but no raise, **the system shall**:
- percentile ≤ pfr → iso-raise (size: openRaiseSize + 1BB × limpers)
- pfr < percentile ≤ vpip → limp-behind
- percentile > vpip → fold

### R3: Situation C — Facing First Raise (non-BB)
**When** a non-BB player faces the first raise, **the system shall**:
- facingRaiseAdjust = 0.5~0.8 (range narrows with raise count)
- 3-bet cutoff = min(threeBetFreq × facingRaiseAdjust, vpip × facingRaiseAdjust)
- calling cutoff = vpip × facingRaiseAdjust
- percentile ≤ 3-bet cutoff → 3-bet
- 3-bet cutoff < percentile ≤ calling cutoff → call
- percentile > calling cutoff → fold

### R4: Situation D — Facing 3-Bet (opener)
**When** the original raiser faces a 3-bet, **the system shall**:
- Step 1: Check 4-bet range (top fourBetRatio of open range) → 4-bet if in range
- Step 2: For hands outside 4-bet range: random < foldTo3Bet → fold, else call

### R5: Situation E — BB Defense
**When** BB faces a raise (always routes here), **the system shall**:
- BB defense cutoff = bbDefenseBase × facingRaiseAdjust × bbDefenseBonus (1.3)
- 3-bet cutoff = min(threeBetFreq × facingRaiseAdjust, BB defense cutoff)
- percentile ≤ 3-bet cutoff → 3-bet
- 3-bet cutoff < percentile ≤ BB defense cutoff → call
- percentile > BB defense cutoff → fold

### R6: Re-raise Sizing
**The system shall** compute re-raise sizes:
- 3-bet: facingRaise × 3.0 (IP) or × 3.5 (OOP) ± 0.5BB noise
- 4-bet: facing3Bet × 2.2 ± 0.5BB noise
- Jam threshold: effectiveStack ≤ jamThresholdBB × BB → all-in
  - 3-bet: 15BB, 4-bet: 25BB, cold call range: 10BB
- All sizes clamped: max(legalMin, computed)

### R7: positionAwareness Interpolation
**The system shall** apply:
`effectivePercentile = baseline + positionAwareness × (positionTable - baseline)`
- baseline = average of 6 ring positions (EP,MP,CO,BTN,SB,BB), HU excluded
- positionAwareness = 0.0 → uniform, 1.0 → full table values
- HU: positionAwareness not applied, HU range table used directly

### R8: Stack/Tournament Adjustments
**The system shall** apply post-decision adjustments:
- Stack depth: effective stack in BB. ≤ 10BB → push/fold mode
- bubbleTightness: range narrowing in bubble zone (4~5 players)
- icmAwareness: chip value adjustment (chip leader attacks, short stack conserves)

### R9: Global Clamp
**The system shall** clamp all probabilities/cutoffs to [0.0, 1.0] after all adjustments.

## 3. Acceptance Criteria

- [ ] AC1: Situation A: TAG opens ~16% of hands in CO position
- [ ] AC2: Situation B: correct iso-raise sizing with limpers
- [ ] AC3: Situation C: 3-bet cutoff ≤ calling cutoff (no inversion)
- [ ] AC4: Situation D: premium hands always 4-bet, marginal hands fold/call per foldTo3Bet
- [ ] AC5: Situation E: BB defends wider than other positions (~30% boost)
- [ ] AC6: Re-raise sizing respects legal minimum
- [ ] AC7: Jam threshold: 12BB stack → all-in instead of 3-bet
- [ ] AC8: positionAwareness=0 produces uniform range across positions
- [ ] AC9: Push/fold mode activates at ≤ 10BB
- [ ] AC10: All cutoffs clamped to [0, 1]

## 4. Files to Create

```
src/ai/preflop.ts              - Preflop decision engine (5 situations)
src/ai/sizing.ts               - Bet/raise sizing calculations
tests/ai/preflop.test.ts       - Situation A-E tests (table-driven)
tests/ai/sizing.test.ts        - Sizing calculation tests
```

## 5. Design Doc Reference

- Section 6.4.3: Preflop Decision (Situations A-E)
- Section 6.4.3.1: Re-raise Sizing Policy
- Section 6.4.4: positionAwareness Interpretation
- Section 6.4.7: Global Numeric Rules
