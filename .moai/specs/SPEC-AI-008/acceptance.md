# SPEC-AI-008 Acceptance Criteria: ICM Calculation Engine & Bubble Factor

## AC-1: ICM Equity Calculation Correctness

**Given** 4 players with stacks [4000, 3000, 2000, 1000] and payouts [6000, 3600, 2400]
**When** `calculateICM` is called
**Then** the returned equities satisfy:
  - Sum of all equities = 12000 (total prize pool)
  - Player with 4000 chips has equity > 4000 (chip leader gains disproportionately)
  - Player with 1000 chips has equity < 1000 (short stack loses disproportionately)
  - All equities are positive

**Verification**: Unit test with known reference ICM values (validated against ICMIZER or similar tool).

---

## AC-2: Equal Stacks Produce Equal Equity

**Given** 4 players with equal stacks [2500, 2500, 2500, 2500] and payouts [6000, 3600, 2400]
**When** `calculateICM` is called
**Then** each player's equity = 3000 (12000 / 4)

**Verification**: Unit test with exact equality check.

---

## AC-3: Bubble Factor Near Bubble

**Given** 4 players (3 paid) with stacks [5000, 3000, 1500, 500]
**When** `computeBubbleFactor` is called for the player with 500 chips
**Then** bubble factor > 2.0 (losing is catastrophic, winning barely helps)
**And** bubble factor for the player with 5000 chips < 1.3 (chip leader risks little)

**Verification**: Unit test with assertions on bubble factor ranges.

---

## AC-4: Bubble Factor Heads-Up

**Given** 2 players remaining with any stack distribution
**When** `computeBubbleFactor` is called
**Then** bubble factor = 1.0 (no ICM pressure heads-up in winner-take-remainder)

**Verification**: Unit test for 2-player scenario.

---

## AC-5: Push/Fold Tightens Near Bubble

**Given** a Shark preset (icmAwareness=0.9, bubbleTightness=0.7) with 8BB stack
**And** 4 players remaining with 3 payout positions
**And** bubble factor = 1.8
**When** `pushFoldDecision` is called with a marginal hand (percentile = 0.25)
**Then** the decision is FOLD (because ICM-adjusted threshold < 0.25)

**Given** the same scenario but icmAwareness=0.0
**When** `pushFoldDecision` is called with the same hand
**Then** the decision is RAISE (all-in) (because ICM has no effect)

**Verification**: Unit test comparing decisions with icmAwareness=0 vs icmAwareness=0.9.

---

## AC-6: Chip Leader Aggression

**Given** a player who is chip leader with 2x the second-largest stack
**And** 4 players remaining, 3 paid
**And** short stack has bubble factor > 1.5
**When** push/fold decision is computed for the chip leader with 7BB
**Then** the push threshold is widened by approximately 15% compared to equal-stack scenario

**Verification**: Unit test comparing push thresholds with and without chip leader bonus.

---

## AC-7: icmAwareness=0 Backward Compatibility

**Given** any preset with icmAwareness overridden to 0.0
**When** 100 tournament hands are simulated
**Then** all AI decisions are identical to the pre-ICM implementation (no behavioral change)

**Verification**: Regression test comparing decision traces before and after ICM integration.

---

## AC-8: Situation C/D/E Tightening

**Given** a TAG preset (icmAwareness=0.7) facing a raise (Situation C)
**And** bubble factor = 1.6
**When** the calling cutoff is computed
**Then** the cutoff is approximately 37.5% tighter than with bubble factor = 1.0
  (1 / 1.6 = 0.625, interpolated by icmAwareness=0.7: ~37.5% reduction)

**Verification**: Unit test on `situationC` with controlled bubble factor inputs.

---

## AC-9: ICM Sum Invariant

**Given** any valid stack distribution and payout structure
**When** `calculateICM` is called
**Then** `sum(equities) === sum(payouts)` (within floating-point tolerance of 0.01)

**Verification**: Property-based test with random stack distributions.

---

## Quality Gate

- All existing preflop/postflop tests pass (no regressions)
- New tests: `icm.test.ts`, `icm-integration.test.ts`
- ICM equity sum invariant holds for 100+ random configurations
- Bubble factor >= 1.0 invariant holds in all cases

## Definition of Done

- [ ] `src/ai/icm.ts` implements Malmuth-Harville ICM calculation
- [ ] `computeBubbleFactor` returns correct values for known scenarios
- [ ] Push/fold threshold adjusted by ICM bubble factor
- [ ] Situations C, D, E adjusted by bubble factor
- [ ] `icmAwareness` knob interpolates between chip-EV and ICM-EV
- [ ] `bubbleTightness` knob scales bubble pressure
- [ ] Chip leader loosening implemented
- [ ] All existing tests pass
- [ ] ICM values validated against reference calculator
