# SPEC-AI-011: Implementation Plan

## Overview

Comprehensive overhaul of the postflop decision engine to add multi-street barrel planning, board-texture-aware check-raising, donk betting, delayed c-bets, pot geometry, BvB adjustments, and style-specific differentiation. This is the most complex AI SPEC and should be implemented incrementally with simulation validation at each milestone.

---

## Milestone 1 (Primary Goal): Enhanced Board Texture & Re-Analysis

**Objective**: Upgrade board texture analysis to return detailed metrics and support re-analysis on turn/river.

### Tasks

1. **Refactor `board-texture.ts`**
   - Change return type from `BoardTexture` to `BoardTextureDetail`
   - Add fields: `flushComplete`, `straightComplete`, `highCardCount`, `pairedCount`, `maxSuitCount`, `connectivity`
   - Ensure function works correctly with 3, 4, or 5 community cards
   - Maintain backward compatibility: `detail.category` replaces old return value

2. **Update `postflop.ts` to re-analyze on each street**
   - Call `analyzeBoardTexture()` at the start of each postflop decision (already done for flop; ensure turn/river also call it)
   - Pass `BoardTextureDetail` instead of just `BoardTexture` to all sub-functions

3. **Update `textureAdjustment` to use detailed texture**
   - Consider `flushComplete`, `straightComplete` for additional adjustments
   - When flush completes on turn/river: reduce barrel frequency by 20%
   - When straight completes: reduce barrel frequency by 15%

4. **Tests**
   - Unit tests for `analyzeBoardTexture` with 3, 4, and 5 cards
   - Test flush completion detection
   - Test straight completion detection
   - Test connectivity scoring

### Files Modified
- `src/ai/board-texture.ts` (major refactor)
- `src/ai/postflop.ts` (update texture usage)
- Tests (new/updated)

---

## Milestone 2 (Primary Goal): Board-Dependent Check-Raise

**Objective**: Replace flat `checkRaiseFreq` with board-texture-aware check-raise ranges.

### Tasks

1. **Add `boardDependentCheckRaiseFreq()` function to `postflop.ts`**
   - Input: `profile.checkRaiseFreq`, `BoardTextureDetail`, `madeTier`, `drawTier`
   - Dry boards: `freq * 0.5` (rarely check-raise)
   - Wet/monotone boards: `freq * 1.3` (more check-raises with draws + made hands)
   - Paired boards: `freq * 0.8` (moderate)
   - Additional boost when holding combo draw (madeTier <= 2 AND drawTier <= 2)

2. **Update `facingBetDecision()` to use board-dependent check-raise**
   - Replace flat `profile.checkRaiseFreq` check with new function
   - Allow check-raise with madeTier 1-2 (currently only madeTier 1)
   - Allow check-raise semi-bluff with drawTier 1-2 on wet boards

3. **Update `passiveDecision()` for check-raise setup**
   - When planning to check-raise, return CHECK (not BET) to set up the raise
   - Store check-raise intent for the `facingBetDecision` call within same street

4. **Tests**
   - Dry board check-raise frequency is lower than wet board
   - Strong hands on wet boards trigger check-raise more often
   - Verify per-preset check-raise rates in 100-hand simulation

### Files Modified
- `src/ai/postflop.ts` (add check-raise logic)
- Tests (new)

---

## Milestone 3 (Primary Goal): Multi-Street Barrel Planning & Pot Geometry

**Objective**: Implement barrel planning that considers future streets and pot geometry for bet sizing.

### Tasks

1. **Add `BarrelPlan` type and `createBarrelPlan()` function**
   - Created when aggressor decides to c-bet on flop
   - Plan considers: made tier, draw tier, board texture, SPR
   - Strong value (tier 1): plan 3 barrels
   - Good hand + draw (tier 2 + draw): plan 2 barrels
   - Pure bluff (tier 4): plan 1 barrel (or 0 if low bluffFreq)

2. **Add `planBetSizing()` to `spr.ts`**
   - Given SPR and streets remaining, calculate bet sizes that achieve target commitment
   - SPR > 8: [33%, 50%, 66%] across 3 streets
   - SPR 3-8: [50%, 66%] or [66%, all-in] across 2 streets
   - SPR < 3: [75-100%] single street or all-in
   - Return array of pot-fraction sizes per street

3. **Integrate barrel plan into `aggressorDecision()`**
   - On flop: create barrel plan, use plan's first sizing
   - On turn: read barrel plan, re-evaluate based on new texture
   - On river: polarize using barrel plan guidance
   - River polarization: bet big (75%+ pot) with tier 1 or bluff, check tier 2-3

4. **Pass barrel plan through `PostflopContext`**
   - `action-selector.ts` must store and retrieve barrel plan between streets
   - Barrel plan stored per-player in a WeakMap or passed through context

5. **Tests**
   - Barrel plan creation for different hand/draw combinations
   - Pot geometry sizing produces valid pot fractions
   - Turn re-evaluation: plan abandoned when scare card hits
   - River polarization: verify tier 2 hands check, tier 1 hands bet

### Files Modified
- `src/ai/postflop.ts` (barrel plan integration)
- `src/ai/spr.ts` (add planBetSizing)
- `src/ai/action-selector.ts` (pass barrel plan)
- `src/types/index.ts` (BarrelPlan type, if shared)
- Tests (new)

---

## Milestone 4 (Secondary Goal): Donk Betting & Delayed C-Bet

**Objective**: Add donk bet capability for non-aggressors and delayed c-bet for aggressors.

### Tasks

1. **Add donk bet logic to `passiveDecision()`**
   - Check rangeAdvantageScore: if < -0.3 (board favors caller), consider donk bet
   - Frequency: `bluffFreq * 0.5` for strong hands (madeTier 1-2)
   - Sizing: 33-50% pot (smaller than standard)
   - Optional: add `donkBetFreq` to AIProfile for per-preset tuning

2. **Add delayed c-bet logic to `aggressorDecision()`**
   - Track whether aggressor checked previous street via `aggressorCheckedPrevStreet` flag
   - On turn, if aggressor checked flop: evaluate delayed c-bet at `turnBarrel * 1.2`
   - Only when turn card doesn't significantly improve caller range

3. **Add optional AIProfile fields**
   - `donkBetFreq?: number` (default 0 for most, 0.1 for Station/Maniac)
   - `overbetFreq?: number` (default 0, 0.15 for Maniac)
   - `riverPolarization?: number` (default 0.5)

4. **Update presets.ts with new defaults**
   - Nit: donkBetFreq=0, overbetFreq=0, riverPolarization=0.3
   - TAG: donkBetFreq=0.05, overbetFreq=0, riverPolarization=0.5
   - LAG: donkBetFreq=0.08, overbetFreq=0.05, riverPolarization=0.7
   - Station: donkBetFreq=0.1, overbetFreq=0, riverPolarization=0.2
   - Maniac: donkBetFreq=0.15, overbetFreq=0.15, riverPolarization=0.8
   - Shark: donkBetFreq=0.07, overbetFreq=0.03, riverPolarization=0.6

5. **Tests**
   - Donk bet triggers only when range advantage favors caller
   - Delayed c-bet frequency higher than normal turn barrel
   - New profile fields validate correctly

### Files Modified
- `src/ai/postflop.ts` (donk + delayed c-bet)
- `src/ai/presets.ts` (new optional fields)
- `src/types/index.ts` (AIProfile extension)
- Tests (new)

---

## Milestone 5 (Secondary Goal): BvB Adjustments & Style Tuning

**Objective**: Add blind-vs-blind specific postflop adjustments and fine-tune per-style behavior.

### Tasks

1. **BvB detection in `action-selector.ts`**
   - Detect BvB: heads-up pot where players are SB and BB
   - Set `isBvB: true` in PostflopContext

2. **BvB adjustments in `postflop.ts`**
   - Widen attack ranges: +15-25% to c-bet/barrel frequencies in BvB
   - Widen defense ranges: -15% to fold frequencies in BvB
   - Increase donk bet frequency: +20% in BvB for BB

3. **Per-style fine-tuning**
   - Review each preset's postflop behavior after M1-M4 changes
   - Verify Nit gives up on wet boards (barrel rate should drop sharply)
   - Verify LAG maintains aggression across streets
   - Verify Maniac overbets at expected frequency
   - Verify Shark has balanced frequencies closest to GTO benchmarks
   - Verify Station calls too much (low fold-to-cbet in all scenarios)

4. **Simulation validation**
   - Run 1K SNG simulation per preset
   - Measure: C-bet%, Turn barrel%, River barrel%, Check-raise%, WTSD%, W$SD%
   - Compare to target ranges from design doc
   - Adjust parameters if metrics deviate significantly

### Target Metric Ranges (per 1K SNG simulation)

| Preset  | C-bet% | Turn Barrel% | River Barrel% | Check-Raise% | WTSD% |
| ------- | ------ | ------------ | ------------- | ------------ | ----- |
| Nit     | 50-60  | 35-45        | 20-30         | 2-5          | 22-28 |
| TAG     | 65-75  | 50-60        | 35-45         | 5-8          | 26-32 |
| LAG     | 70-80  | 55-65        | 40-50         | 8-12         | 30-36 |
| Station | 30-40  | 20-30        | 10-20         | 1-3          | 38-45 |
| Maniac  | 80-90  | 65-75        | 50-60         | 12-18        | 35-42 |
| Shark   | 63-72  | 48-56        | 34-42         | 6-10         | 28-34 |

### Files Modified
- `src/ai/action-selector.ts` (BvB detection)
- `src/ai/postflop.ts` (BvB adjustments)
- `src/ai/presets.ts` (tuning)
- Simulation scripts (new/updated)

---

## Technical Approach

### Architecture After Implementation

```
action-selector.ts
  buildPostflopContext() -- now includes barrelPlan, isBvB, position
       |
       v
postflop.ts
  makePostflopDecision()
    |-- board-texture.ts: analyzeBoardTexture() -> BoardTextureDetail
    |-- hand-classifier.ts: classifyHand() (unchanged)
    |-- spr.ts: sprBetSizing() + planBetSizing() (new)
    |
    |-- aggressorDecision()
    |     |-- createBarrelPlan() (new)
    |     |-- delayedCBet() (new)
    |     |-- potGeometrySizing() (new)
    |
    |-- facingBetDecision()
    |     |-- boardDependentCheckRaise() (new)
    |
    |-- passiveDecision()
          |-- donkBetEvaluation() (new)
```

### Key Design Decisions

- **Barrel plan as data, not state**: Barrel plans are calculated fresh each decision using hand/board/profile data, not stored between streets. This preserves the stateless, functional architecture.
- **Additive profile fields**: New AIProfile fields (`donkBetFreq`, `overbetFreq`, `riverPolarization`) are optional with sensible defaults, maintaining backward compatibility.
- **Board texture detail**: Returning a detailed object instead of a simple enum allows finer-grained strategy adjustments without breaking existing consumers.
- **Re-analysis per street**: Calling `analyzeBoardTexture()` on every street decision ensures strategy adapts to new cards.

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Performance regression from complex logic | Low | High | Profile decision time; target <5ms |
| Barrel plan makes AI too predictable | Medium | Medium | Add randomization to plan creation; plans are guidelines, not mandates |
| Style differentiation insufficient | Medium | High | Simulation validation at M5; iterate tuning |
| Breaking deterministic replay | Low | Critical | All new logic must use seeded RNG; replay comparison tests |
| Regression in existing AI behavior | Medium | High | Run full SNG simulation before and after; compare stat distributions |
